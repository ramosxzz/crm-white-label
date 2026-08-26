"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canOperateLead, assertRole, canManageCompanySettings, canSeeAllLeads, canDeleteLead } from "@/lib/auth/roles";
import { chooseRoundRobinAttendant } from "@/lib/leads/assignment";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { normalizePhone } from "@/lib/utils";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { logLeadActivity } from "@/lib/leads/activity-log";
import { notifyUser, getTenantOwnerId } from "@/lib/notifications/notify";
import { forwardNewLead } from "@/lib/leads/forward-new-lead";
import { dispatchWebhookEvent } from "@/lib/api/dispatch-webhook";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { suggestCsvMapping, type CsvFieldMapping } from "@/lib/ai/csv-mapping";
import { isDuplicateLeadPhoneError, prepareSpreadsheetLeads } from "@/lib/leads/spreadsheet-import";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { getValidAccessToken, listLeadEmails, type GmailMessageSummary } from "@/lib/google/gmail";

const leadSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  notes: z.string().optional(),
  stage_id: z.string().uuid().optional(),
  value_cents: z.number().int().min(0).optional(),
  referred_by_partner_id: z.string().uuid().optional(),
});

// Modo ausente: define (ou limpa, com null) o vendedor que recebe os novos leads.
export async function setLeadForwarding(userId: string | null) {
  const ctx = await requireContext();
  if (!canManageCompanySettings(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();

  if (userId) {
    const { data: member } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) throw new Error("Usuario nao pertence a este workspace");
  }

  const { error } = await supabase
    .from("tenants")
    .update({ lead_forward_user_id: userId })
    .eq("id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/chat");
  return { ok: true };
}

export type CreateLeadResult =
  | { ok: true; leadId: string }
  | { ok: false; error: string };

export async function createLead(formData: FormData): Promise<CreateLeadResult> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const parsedResult = leadSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    source: formData.get("source") || undefined,
    notes: formData.get("notes") || undefined,
    stage_id: formData.get("stage_id") || undefined,
    value_cents: formData.get("value_cents")
      ? Math.round(Number(formData.get("value_cents")) * 100)
      : 0,
    referred_by_partner_id: formData.get("referred_by_partner_id") || undefined,
  });
  if (!parsedResult.success) {
    return { ok: false, error: parsedResult.error.issues[0]?.message ?? "Revise os dados do lead." };
  }
  const parsed = parsedResult.data;

  let stageId = parsed.stage_id;
  if (!stageId) {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id, pipeline_stages(id, position)")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_default", true)
      .single();
    const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
      ?.pipeline_stages?.sort((a, b) => a.position - b.position);
    stageId = stages?.[0]?.id;
  }
  if (!stageId) {
    return { ok: false, error: "Nenhuma etapa do funil está configurada para receber este lead." };
  }

  const { data: pipelineRow } = await supabase
    .from("pipeline_stages")
    .select("pipeline_id")
    .eq("id", stageId!)
    .single();

  const { data: createdLead, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: ctx.tenantId,
      name: parsed.name,
      phone: parsed.phone ? normalizePhone(parsed.phone) : null,
      email: parsed.email || null,
      source: parsed.source || null,
      notes: parsed.notes || null,
      stage_id: stageId,
      pipeline_id: pipelineRow?.pipeline_id,
      value_cents: parsed.value_cents ?? 0,
      referred_by_partner_id: parsed.referred_by_partner_id ?? null,
      assigned_to:
        ctx.role === "vendedor" && ctx.tenant.lead_assignment_enabled
          ? ctx.userId
          : null,
    })
    .select("id")
    .single();

  if (error) {
    if (isDuplicateLeadPhoneError(error)) {
      return { ok: false, error: "Já existe um lead cadastrado com este telefone." };
    }
    console.error("[leads] Falha ao criar lead", { tenantId: ctx.tenantId, code: error.code });
    return { ok: false, error: "Não foi possível criar o lead agora. Tente novamente." };
  }
  if (createdLead) {
    if (parsed.value_cents && parsed.value_cents > 0) {
      await supabase.from("lead_value_items").insert({
        tenant_id: ctx.tenantId,
        lead_id: createdLead.id,
        label: "Valor inicial",
        amount_cents: parsed.value_cents,
        created_by: ctx.userId,
      });
    }
    try {
      // Lead indicado por parceiro (loja/vendedor): fica sem dono de proposito,
      // pra coordenadora triar manualmente - pedido explicito do ACT, pra nao
      // cair no sorteio automatico junto com os leads de marketing.
      if (ctx.role === "vendedor" && ctx.tenant.lead_assignment_enabled) {
        // No tenant com distribuicao ativa, o lead cadastrado pela propria
        // vendedora permanece com ela e nao entra no fluxo automatico.
      } else if (parsed.referred_by_partner_id) {
        // no-op: sem modo ausente, sem round-robin.
      } else {
        // Modo ausente tem prioridade: se ativo, o lead vai direto para o
        // vendedor escolhido; senao, distribuicao normal (round-robin).
        const forwarded = await forwardNewLead(supabase, ctx.tenantId, createdLead.id);
        if (!forwarded) await autoAssignLead(createdLead.id);
      }
    } catch (assignmentError) {
      console.error("Erro ao distribuir lead automaticamente:", assignmentError);
    }
    void fireAutomationTrigger(ctx.tenantId, "lead_created", createdLead.id, {
      source: parsed.source,
    });
    void dispatchWebhookEvent(ctx.tenantId, "lead.created", {
      id: createdLead.id,
      name: parsed.name,
      phone: parsed.phone ?? null,
      source: parsed.source ?? null,
    });

    // Vendedor criou um lead: avisa o dono (owner) do tenant.
    if (ctx.role === "vendedor") {
      const ownerId = await getTenantOwnerId(supabase, ctx.tenantId);
      if (ownerId && ownerId !== ctx.userId) {
        void notifyUser(supabase, {
          tenantId: ctx.tenantId,
          userId: ownerId,
          kind: "lead_created_by_seller",
          title: "Novo lead criado por vendedor",
          description: parsed.name,
          link: `/leads/${createdLead.id}`,
        });
      }
    }
  }

  revalidatePath("/leads");
  revalidatePath("/kanban");
  return { ok: true, leadId: createdLead!.id };
}

export async function updateLead(id: string, patch: Partial<{
  name: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
  stage_id: string;
  value_cents: number;
  position: number;
}>) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const data = { ...patch };
  if (data.phone) data.phone = normalizePhone(data.phone);

  // Ao mover para uma etapa de ganho, marca won_at (para contabilizar ganhos do dia);
  // ao sair de uma etapa de ganho, limpa. Reordenar dentro da mesma etapa nao altera.
  let stageIsWon = false;
  let stageChange: { fromId: string | null; toId: string; toName: string | null } | null = null;
  if (patch.stage_id) {
    const [{ data: stageRow }, { data: currentLead }] = await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("is_won, name, pipeline_id")
        .eq("id", patch.stage_id)
        .eq("tenant_id", ctx.tenantId)
        .single(),
      supabase
        .from("leads")
        .select("stage_id, won_at")
        .eq("id", id)
        .eq("tenant_id", ctx.tenantId)
        .single(),
    ]);
    if (!stageRow) throw new Error("Etapa nao encontrada");
    (data as Record<string, unknown>).pipeline_id = (stageRow as { pipeline_id: string }).pipeline_id;
    stageIsWon = Boolean((stageRow as { is_won: boolean } | null)?.is_won);
    const cur = currentLead as { stage_id: string | null; won_at: string | null } | null;
    if (cur && cur.stage_id !== patch.stage_id) {
      stageChange = {
        fromId: cur.stage_id,
        toId: patch.stage_id,
        toName: (stageRow as { name?: string | null } | null)?.name ?? null,
      };
    }
    if (stageIsWon) {
      if (!cur?.won_at || cur.stage_id !== patch.stage_id) {
        (data as Record<string, unknown>).won_at = new Date().toISOString();
      }
    } else {
      (data as Record<string, unknown>).won_at = null;
    }
  }

  const { error } = await supabase
    .from("leads")
    .update(data)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) throw new Error(error.message);

  if (stageChange) {
    let fromName: string | null = null;
    if (stageChange.fromId) {
      const { data: fromStage } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("id", stageChange.fromId)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      fromName = (fromStage as { name?: string | null } | null)?.name ?? null;
    }
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: id,
      userId: ctx.userId,
      kind: "stage_changed",
      payload: { from_stage_name: fromName, to_stage_name: stageChange.toName },
    });
  }

  if (patch.stage_id && stageIsWon) {
    const { notifyMetaLeadWon } = await import("@/lib/meta/notify-lead-won");
    void notifyMetaLeadWon(supabase, ctx.tenantId, id, patch.value_cents ?? null);
  }

  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath(`/leads/${id}`);
  revalidatePath(`/chat/${id}`);
}

export async function moveLeadToStage(leadId: string, stageId: string, position: number) {
  const ctx = await requireContext();
  await updateLead(leadId, { stage_id: stageId, position });
  void fireAutomationTrigger(ctx.tenantId, "stage_changed", leadId, { stage_id: stageId });
  void dispatchWebhookEvent(ctx.tenantId, "lead.stage_changed", { id: leadId, stage_id: stageId });
}

export async function moveLeadsToStage(leadIds: string[], stageId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("leads")
    .select("id, position")
    .eq("tenant_id", ctx.tenantId)
    .eq("stage_id", stageId)
    .order("position", { ascending: false })
    .limit(1);
  let position = ((existing?.[0] as { position?: number } | undefined)?.position ?? 0) + 1000;

  for (const leadId of leadIds) {
    await updateLead(leadId, { stage_id: stageId, position });
    position += 1000;
    void fireAutomationTrigger(ctx.tenantId, "stage_changed", leadId, { stage_id: stageId });
    void dispatchWebhookEvent(ctx.tenantId, "lead.stage_changed", { id: leadId, stage_id: stageId });
  }
}

export async function assignLead(input: {
  leadId: string;
  toUserId: string | null;
  reason: "round_robin" | "manual_assign" | "transfer" | "return_to_queue";
}) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: input.toUserId })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  const { error: historyError } = await supabase.from("lead_assignment_history").insert({
    tenant_id: ctx.tenantId,
    lead_id: input.leadId,
    from_user_id: lead.assigned_to,
    to_user_id: input.toUserId,
    assigned_by: ctx.userId,
    reason: input.reason,
  });
  if (historyError) throw new Error(historyError.message);

  if ((lead as { assigned_to: string | null }).assigned_to !== input.toUserId) {
    let toName: string | null = null;
    if (input.toUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", input.toUserId)
        .maybeSingle();
      toName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
    }
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      userId: ctx.userId,
      kind: "assigned",
      payload: { to_user_name: toName, unassigned: !input.toUserId },
    });

    // Avisa quem recebeu o lead (owner/admin enviou para o vendedor).
    if (input.toUserId && input.toUserId !== ctx.userId) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("name")
        .eq("id", input.leadId)
        .maybeSingle();
      void notifyUser(supabase, {
        tenantId: ctx.tenantId,
        userId: input.toUserId,
        kind: "lead_assigned",
        title: "Novo lead atribuido a voce",
        description: (leadRow as { name?: string } | null)?.name ?? "Um lead foi enviado para voce",
        link: `/leads/${input.leadId}`,
      });
    }
  }

  revalidatePath("/leads");
  revalidatePath("/kanban");
}

// Atribuicao em massa: admin/gerente manda um grupo de leads pra um vendedor
// de uma vez (ou volta pra fila com toUserId null).
export async function bulkAssignLeads(leadIds: string[], toUserId: string | null) {
  const ctx = await requireContext();
  if (!canSeeAllLeads(ctx.role)) throw new Error("Sem permissao para atribuir leads");
  if (leadIds.length === 0) return { count: 0 };

  for (const leadId of leadIds) {
    await assignLead({ leadId, toUserId, reason: "manual_assign" });
  }
  return { count: leadIds.length };
}

export async function autoAssignLead(leadId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: attendants, error } = await supabase
    .from("attendant_status")
    .select("user_id, is_available, last_assigned_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_available", true);
  if (error) throw new Error(error.message);

  const selected = chooseRoundRobinAttendant(attendants ?? []);
  if (!selected) return null;

  await assignLead({ leadId, toUserId: selected.user_id, reason: "round_robin" });
  const { error: statusError } = await supabase
    .from("attendant_status")
    .update({ last_assigned_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", selected.user_id);
  if (statusError) throw new Error(statusError.message);
  return selected.user_id;
}

// Exporta leads em CSV, opcionalmente so das etapas escolhidas ("quero
// exportar os leads apenas de passei valores, primeiro contato"). Sem etapa
// marcada = todas. O periodo vem da mesma barra de filtro da tela, pra o que
// sai no arquivo bater com o que a pessoa esta vendo.
export async function exportLeadsCSV(input: {
  stageIds?: string[];
  startIso?: string | null;
  endIso?: string | null;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Quem ve o que e decidido pela RLS (private.can_access_lead), nao aqui.
  // Filtrar por assigned_to nesta consulta parecia "a mesma coisa", mas a
  // regra do banco e mais ampla: o vendedor tambem alcanca o lead pela conta
  // de WhatsApp atribuida a ele. Repetir o corte aqui deixaria de fora leads
  // que ele esta vendo na tela, e o arquivo sairia menor que a listagem.
  let query = supabase
    .from("leads")
    .select("name, phone, email, source, value_cents, created_at, stage_id, assigned_to")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });

  if (input.stageIds && input.stageIds.length > 0) query = query.in("stage_id", input.stageIds);
  if (input.startIso) query = query.gte("created_at", input.startIso);
  if (input.endIso) query = query.lte("created_at", input.endIso);

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, name")
    .eq("tenant_id", ctx.tenantId);
  const stageName = new Map(((stages ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  const members = canSeeAllLeads(ctx.role) ? await listTenantUserOptions(ctx.tenantId) : [];
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  // Campo entre aspas com aspas internas dobradas - nome com virgula
  // (ex: "Silva, Maria") quebraria a coluna sem isso.
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const header = ["Nome", "Telefone", "Email", "Etapa", "Origem", "Responsavel", "Valor", "Entrada"];
  const lines = [header.join(",")];
  for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
    lines.push(
      [
        escape(r.name),
        escape(r.phone),
        escape(r.email),
        escape(stageName.get(String(r.stage_id ?? "")) ?? ""),
        escape(r.source),
        escape(r.assigned_to ? memberName.get(String(r.assigned_to)) ?? "" : ""),
        escape(((Number(r.value_cents) || 0) / 100).toFixed(2).replace(".", ",")),
        escape(r.created_at),
      ].join(","),
    );
  }

  return { csv: lines.join("\n"), count: rows?.length ?? 0 };
}

export async function deleteLead(id: string) {
  const ctx = await requireContext();
  if (!canDeleteLead(ctx.role)) throw new Error("Sem permissao para excluir leads");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  void logAuditEvent(supabase, {
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "lead.delete",
    resourceType: "lead",
    resourceId: id,
    metadata: { deleted_lead_id: id },
  });

  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath("/chat");
}

// So le cabecalho + poucas linhas de exemplo, nunca a planilha inteira -
// rapido mesmo com milhares de linhas. `requireContext` so pra nao expor
// isso a quem nao esta logado; qualquer papel que pode importar pode pedir
// a sugestao.
export async function getCsvMappingSuggestion(
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<CsvFieldMapping> {
  await requireContext();
  return suggestCsvMapping(headers, sampleRows);
}

export async function importLeadsCSV(
  rows: Array<{ name: string; phone?: string; email?: string; source?: string }>,
  assignedTo?: string | null,
  folder?: "primeiro_contato" | "reaplicacao" | "mkt" | null,
) {
  const ctx = await requireContext();
  const supabase = await createClient();

  // So owner/admin/gerente podem escolher pra quem manda a planilha inteira.
  if (assignedTo && !canSeeAllLeads(ctx.role)) throw new Error("Sem permissao para atribuir leads");
  // Mandar pra pasta so faz sentido pro tenant que usa o modulo de pastas -
  // e o mesmo publico que ja pode atribuir a planilha inteira.
  if (folder && (!ctx.tenant.lead_folders_enabled || !canSeeAllLeads(ctx.role))) {
    throw new Error("Sem permissao para enviar pra pasta");
  }
  if (assignedTo) {
    const { data: member } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", assignedTo)
      .maybeSingle();
    if (!member) throw new Error("Usuario nao pertence a este workspace");
  }

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_default", true)
    .single();
  const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
    ?.pipeline_stages?.sort((a, b) => a.position - b.position);
  const stageId = stages?.[0]?.id;
  const pipelineId = (pipeline as { id?: string } | null)?.id;

  const prepared = prepareSpreadsheetLeads(rows);
  let skippedDuplicates = prepared.skippedDuplicates;

  // Evita que um telefone que ja existe no tenant invalide o lote inteiro.
  // A verificacao antecipada deixa o caminho comum rapido; o fallback abaixo
  // ainda cobre concorrencia e linhas ocultas por RLS.
  const phones = prepared.rows.flatMap((row) => (row.phone ? [row.phone] : []));
  const existingPhones = new Set<string>();
  for (let index = 0; index < phones.length; index += 500) {
    const { data: existing, error: existingError } = await supabase
      .from("leads")
      .select("phone")
      .eq("tenant_id", ctx.tenantId)
      .in("phone", phones.slice(index, index + 500));
    if (existingError) throw new Error(existingError.message);
    for (const row of existing ?? []) {
      if (row.phone) existingPhones.add(row.phone);
    }
  }

  const newRows = prepared.rows.filter((row) => {
    if (!row.phone || !existingPhones.has(row.phone)) return true;
    skippedDuplicates++;
    return false;
  });

  const inserts = newRows.map((r) => ({
      tenant_id: ctx.tenantId,
      name: r.name,
      phone: r.phone,
      email: r.email,
      source: r.source || "csv-import",
      stage_id: stageId,
      pipeline_id: pipelineId,
      assigned_to: assignedTo || null,
      lead_folder: folder || null,
    }));

  if (inserts.length === 0) {
    return { count: 0, skippedDuplicates, invalidPhones: prepared.invalidPhones };
  }

  let { data: createdLeads, error } = await supabase.from("leads").insert(inserts).select("id");
  if (error && isDuplicateLeadPhoneError(error)) {
    // O insert em lote e atomico. Se surgiu um duplicado entre a consulta e
    // a gravacao (ou ele estava invisivel por RLS), tenta cada linha para nao
    // perder todas as outras.
    createdLeads = [];
    for (const insert of inserts) {
      const { data: created, error: rowError } = await supabase.from("leads").insert(insert).select("id").maybeSingle();
      if (isDuplicateLeadPhoneError(rowError)) {
        skippedDuplicates++;
        continue;
      }
      if (rowError) throw new Error(rowError.message);
      if (created) createdLeads.push(created);
    }
    error = null;
  }
  if (error) throw new Error(error.message);
  // Atribuicao explicita (planilha mandada pra alguem especifico) tem
  // prioridade - so distribui por round-robin quem ficou sem dono. Mandado
  // pra pasta e fila de proposito (mesma logica da prospeccao): round-robin
  // aqui tiraria o sentido de "Michele distribui manualmente" da pasta.
  if (!assignedTo && !folder) {
    for (const lead of createdLeads ?? []) {
      try {
        await autoAssignLead(lead.id);
      } catch (assignmentError) {
        console.error("Erro ao distribuir lead importado automaticamente:", assignmentError);
      }
    }
  }

  void logAuditEvent(supabase, {
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    action: "lead.import_csv",
    resourceType: "lead",
    metadata: {
      imported_count: createdLeads?.length ?? 0,
      skipped_duplicates: skippedDuplicates,
      invalid_phones: prepared.invalidPhones,
      assigned_to: assignedTo || null,
    },
  });

  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath("/pastas");
  return {
    count: createdLeads?.length ?? 0,
    skippedDuplicates,
    invalidPhones: prepared.invalidPhones,
  };
}

export async function listTagsWithLeadCount(): Promise<
  Array<{ tag: string; count: number; leadIds: string[] }>
> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const [{ data: leads, error: leadsError }, { data: catalog, error: catalogError }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, tags")
      .eq("tenant_id", ctx.tenantId)
      .not("tags", "eq", "{}"),
    supabase
      .from("lead_tag_catalog")
      .select("name")
      .eq("tenant_id", ctx.tenantId)
      .order("name"),
  ]);

  if (leadsError) throw new Error(leadsError.message);
  if (catalogError) throw new Error(catalogError.message);

  // O catalogo precisa aparecer mesmo antes de a primeira tag ser aplicada.
  // Antes, a sidebar era montada apenas a partir de leads ja marcados; em um
  // tenant novo ela recebia [] e se escondia, embora houvesse tags cadastradas.
  const tagMap = new Map<string, { name: string; leadIds: string[] }>();
  for (const row of catalog ?? []) {
    const name = row.name.trim();
    if (!name || name.startsWith("__")) continue;
    tagMap.set(name.toLocaleLowerCase("pt-BR"), { name, leadIds: [] });
  }

  for (const lead of leads ?? []) {
    for (const tag of lead.tags ?? []) {
      if (tag.startsWith("__")) continue;
      const name = tag.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase("pt-BR");
      const existing = tagMap.get(key) ?? { name, leadIds: [] };
      existing.leadIds.push(lead.id);
      tagMap.set(key, existing);
    }
  }

  return [...tagMap.values()]
    .map(({ name, leadIds }) => ({ tag: name, count: leadIds.length, leadIds }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
}

export type CreateLeadTagResult =
  | { ok: true; tag: string }
  | { ok: false; error: string };

/** Cadastra uma tag no catalogo sem precisar aplica-la imediatamente a um lead. */
export async function createLeadTag(name: string): Promise<CreateLeadTagResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const tag = String(name ?? "").trim();

  if (!tag) return { ok: false, error: "Informe o nome da tag." };
  if (tag.length > 40) return { ok: false, error: "A tag pode ter no máximo 40 caracteres." };
  if (tag.startsWith("__")) return { ok: false, error: "Esse nome é reservado pelo sistema." };

  const { error } = await supabase.from("lead_tag_catalog").insert({
    tenant_id: ctx.tenantId,
    name: tag,
    created_by: ctx.userId,
  });

  if (error?.code === "23505") return { ok: false, error: "Essa tag já está cadastrada." };
  if (error) return { ok: false, error: "Não foi possível cadastrar a tag." };

  revalidatePath("/tags");
  revalidatePath("/leads");
  revalidatePath("/chat");
  return { ok: true, tag };
}

export async function listLeadGmailMessages(
  leadId: string,
): Promise<{ ok: true; messages: GmailMessageSummary[] } | { ok: false; error: string }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("email")
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!lead?.email) return { ok: false, error: "Lead sem email cadastrado." };

  const account = await getValidAccessToken(supabase, ctx.tenantId);
  if (!account) return { ok: false, error: "Nenhuma conta do Gmail conectada." };

  try {
    const messages = await listLeadEmails(account.accessToken, lead.email);
    return { ok: true, messages };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
