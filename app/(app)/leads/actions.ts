"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canOperateLead, assertRole, canManageCompanySettings, canSeeAllLeads } from "@/lib/auth/roles";
import { chooseRoundRobinAttendant } from "@/lib/leads/assignment";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { normalizePhone } from "@/lib/utils";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { logLeadActivity } from "@/lib/leads/activity-log";
import { notifyUser, getTenantOwnerId } from "@/lib/notifications/notify";
import { forwardNewLead } from "@/lib/leads/forward-new-lead";
import { dispatchWebhookEvent } from "@/lib/api/dispatch-webhook";

const leadSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  notes: z.string().optional(),
  stage_id: z.string().uuid().optional(),
  value_cents: z.number().int().min(0).optional(),
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

export async function createLead(formData: FormData) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const parsed = leadSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    source: formData.get("source") || undefined,
    notes: formData.get("notes") || undefined,
    stage_id: formData.get("stage_id") || undefined,
    value_cents: formData.get("value_cents")
      ? Math.round(Number(formData.get("value_cents")) * 100)
      : 0,
  });

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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
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
      // Modo ausente tem prioridade: se ativo, o lead vai direto para o
      // vendedor escolhido; senao, distribuicao normal (round-robin).
      const forwarded = await forwardNewLead(supabase, ctx.tenantId, createdLead.id);
      if (!forwarded) await autoAssignLead(createdLead.id);
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

export async function deleteLead(id: string) {
  const ctx = await requireContext();
  if (ctx.role === "vendedor") throw new Error("Sem permissao para excluir leads");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath("/chat");
}

export async function importLeadsCSV(rows: Array<{ name: string; phone?: string; email?: string; source?: string }>) {
  const ctx = await requireContext();
  const supabase = await createClient();

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

  const inserts = rows
    .filter((r) => r.name?.trim())
    .map((r) => ({
      tenant_id: ctx.tenantId,
      name: r.name.trim(),
      phone: r.phone ? normalizePhone(r.phone) : null,
      email: r.email?.trim() || null,
      source: r.source?.trim() || "csv-import",
      stage_id: stageId,
      pipeline_id: pipelineId,
    }));

  if (inserts.length === 0) return { count: 0 };
  const { data: createdLeads, error, count } = await supabase.from("leads").insert(inserts, { count: "exact" }).select("id");
  if (error) throw new Error(error.message);
  for (const lead of createdLeads ?? []) {
    try {
      await autoAssignLead(lead.id);
    } catch (assignmentError) {
      console.error("Erro ao distribuir lead importado automaticamente:", assignmentError);
    }
  }
  revalidatePath("/leads");
  revalidatePath("/kanban");
  return { count: count ?? inserts.length };
}
