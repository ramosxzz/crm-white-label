"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  canAccessServiceOrders,
  canApproveServiceOrderDiscount,
  canCreateServiceOrder,
  canManageServiceOrders,
  canReopenServiceOrder,
  canReviewServiceOrder,
} from "@/lib/auth/roles";
import { canTransitionServiceOrder } from "@/lib/field-service/status";
import { listTechnicians } from "@/lib/field-service/users";
import type {
  CommissionParty,
  Database,
  ServiceOrder,
  ServiceOrderStatus,
} from "@/lib/supabase/database.types";
import { formatCurrencyBRL } from "@/lib/utils";

type Ctx = Awaited<ReturnType<typeof requireContext>>;

function assertFieldServiceEnabled(ctx: Ctx) {
  if (!ctx.tenant.field_service_enabled) {
    throw new Error("Modulo de servico em campo desativado para esta empresa");
  }
}

/** Leitura da OS: gestao, consultora da venda e tecnico alocado (a RLS filtra). */
async function requireFieldServiceContext() {
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  // Vendedora entra por canCreateServiceOrder: ela abre a OS da venda dela
  // (e ve essa OS), mesmo sem acesso a lista/roteiro/mapa do escritorio.
  if (!canAccessServiceOrders(ctx.role) && !canCreateServiceOrder(ctx.role) && ctx.role !== "tecnico") {
    throw new Error("Sem permissao para acessar ordens de servico");
  }
  return ctx;
}

/** Escrita administrativa: criar, agendar, alocar tecnico, roteirizar. */
async function requireManagerContext() {
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canManageServiceOrders(ctx.role)) {
    throw new Error("Sem permissao para gerenciar ordens de servico");
  }
  return ctx;
}

const addressSchema = {
  address_street: z.string().trim().optional(),
  address_number: z.string().trim().optional(),
  address_complement: z.string().trim().optional(),
  address_district: z.string().trim().optional(),
  address_city: z.string().trim().optional(),
  address_state: z.string().trim().max(2).optional(),
  address_cep: z.string().trim().optional(),
};

/** Percentual negociado: campo de texto vazio vira nulo (usa a regra global). */
const percentField = z
  .union([z.coerce.number().min(0).max(100), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : (v as number)));

/** Select de parceiro: "" (nenhum selecionado) vira nulo. */
const partnerIdField = z
  .union([z.string().uuid(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const SALE_CHANNELS = [
  "instagram",
  "anuncio",
  "marketing",
  "ja_e_cliente",
  "indicacao",
  "loja_parceira",
  "outro",
] as const;

const createSchema = z.object({
  lead_id: z.string().uuid(),
  consultant_id: z.string().uuid().optional(),
  consultant_extra_id: z.string().uuid().optional(),
  voltage: z.enum(["110v", "220v"]).optional(),
  deadline: z.string().optional(),
  notes: z.string().trim().optional(),
  observations: z.string().trim().optional(),
  sale_channel: z.enum(SALE_CHANNELS).optional(),
  partner_store: z.string().trim().optional(),
  partner_seller_name: z.string().trim().optional(),
  partner_commission_percent: percentField,
  partner_store_id: partnerIdField,
  partner_seller_id: partnerIdField,
  partner_store_split_percent: percentField,
  partner_extra_name: z.string().trim().optional(),
  partner_extra_percent: percentField,
  ...addressSchema,
});

function emptyToNull(value: string | undefined | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function readForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Numero da OS e sequencial por tenant. A unique (tenant_id, code_seq) garante
 * que duas criacoes simultaneas nao gerem o mesmo numero - nesse caso a segunda
 * falha e a gente tenta de novo com o proximo numero.
 */
type ServiceOrderInsert = Omit<
  Database["public"]["Tables"]["service_orders"]["Insert"],
  "tenant_id" | "code_seq"
>;

async function insertWithSequentialCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  payload: ServiceOrderInsert,
): Promise<ServiceOrder> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await supabase
      .from("service_orders")
      .select("code_seq")
      .eq("tenant_id", tenantId)
      .order("code_seq", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextCode = ((last?.code_seq as number | undefined) ?? 0) + 1 + attempt;

    const { data, error } = await supabase
      .from("service_orders")
      .insert({ ...payload, tenant_id: tenantId, code_seq: nextCode })
      .select("*")
      .single();

    if (!error && data) return data as ServiceOrder;
    // 23505 = unique_violation: outro usuario pegou esse numero, tenta o proximo.
    if (error && (error as { code?: string }).code !== "23505") {
      throw new Error(error.message);
    }
  }
  throw new Error("Nao foi possivel gerar o numero da OS. Tente novamente.");
}

/**
 * Ao faturar, o cliente vira candidato a reaplicacao (a impermeabilizacao
 * degrada com o tempo e precisa repetir). Move o lead pra pasta de
 * reaplicacao, ja atribuido a mesma consultora que vendeu - ela quem vai
 * fazer o follow-up daqui uns meses, sem precisar Michele redistribuir de
 * novo algo que ja tem dono.
 */
async function routeLeadToReapplicationFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  serviceOrderId: string,
) {
  const { data: order } = await supabase
    .from("service_orders")
    .select("lead_id, consultant_id")
    .eq("id", serviceOrderId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!order?.lead_id) return;

  await supabase
    .from("leads")
    .update({ lead_folder: "reaplicacao", assigned_to: order.consultant_id ?? null })
    .eq("id", order.lead_id)
    .eq("tenant_id", tenantId);
}

async function logStatusChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Ctx,
  orderId: string,
  from: ServiceOrderStatus | null,
  to: ServiceOrderStatus,
  reason?: string | null,
) {
  await supabase.from("service_order_events").insert({
    tenant_id: ctx.tenantId,
    service_order_id: orderId,
    from_status: from,
    to_status: to,
    user_id: ctx.userId,
    reason: reason ?? null,
  });
}

export async function createServiceOrder(formData: FormData) {
  // Abrir OS e o fechamento da venda da vendedora, nao so do escritorio -
  // por isso aqui e canCreateServiceOrder e nao requireManagerContext.
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canCreateServiceOrder(ctx.role)) {
    throw new Error("Sem permissao para abrir ordem de servico");
  }
  const supabase = await createClient();

  const parsed = createSchema.parse({
    lead_id: formData.get("lead_id"),
    consultant_id: readForm(formData, "consultant_id"),
    consultant_extra_id: readForm(formData, "consultant_extra_id"),
    voltage: readForm(formData, "voltage"),
    deadline: readForm(formData, "deadline"),
    notes: readForm(formData, "notes"),
    observations: readForm(formData, "observations"),
    sale_channel: readForm(formData, "sale_channel"),
    partner_store: readForm(formData, "partner_store"),
    partner_seller_name: readForm(formData, "partner_seller_name"),
    partner_commission_percent: readForm(formData, "partner_commission_percent") ?? "",
    partner_store_id: readForm(formData, "partner_store_id") ?? "",
    partner_seller_id: readForm(formData, "partner_seller_id") ?? "",
    partner_store_split_percent: readForm(formData, "partner_store_split_percent") ?? "",
    partner_extra_name: readForm(formData, "partner_extra_name"),
    partner_extra_percent: readForm(formData, "partner_extra_percent") ?? "",
    address_street: readForm(formData, "address_street"),
    address_number: readForm(formData, "address_number"),
    address_complement: readForm(formData, "address_complement"),
    address_district: readForm(formData, "address_district"),
    address_city: readForm(formData, "address_city"),
    address_state: readForm(formData, "address_state"),
    address_cep: readForm(formData, "address_cep"),
  });

  const order = await insertWithSequentialCode(supabase, ctx.tenantId, {
    lead_id: parsed.lead_id,
    consultant_id: parsed.consultant_id ?? null,
    consultant_extra_id: parsed.consultant_extra_id ?? null,
    created_by: ctx.userId,
    status: "rascunho",
    voltage: parsed.voltage ?? null,
    deadline: parsed.deadline ?? null,
    notes: emptyToNull(parsed.notes),
    observations: emptyToNull(parsed.observations),
    sale_channel: parsed.sale_channel ?? null,
    partner_store: emptyToNull(parsed.partner_store),
    partner_seller_name: emptyToNull(parsed.partner_seller_name),
    partner_commission_percent: parsed.partner_commission_percent,
    partner_store_id: parsed.partner_store_id,
    partner_seller_id: parsed.partner_seller_id,
    partner_store_split_percent: parsed.partner_store_split_percent,
    partner_extra_name: emptyToNull(parsed.partner_extra_name),
    partner_extra_percent: parsed.partner_extra_percent,
    address_street: emptyToNull(parsed.address_street),
    address_number: emptyToNull(parsed.address_number),
    address_complement: emptyToNull(parsed.address_complement),
    address_district: emptyToNull(parsed.address_district),
    address_city: emptyToNull(parsed.address_city),
    address_state: emptyToNull(parsed.address_state),
    address_cep: emptyToNull(parsed.address_cep),
  });

  await logStatusChange(supabase, ctx, order.id, null, "rascunho", "OS criada");

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  return order.id;
}

const updateSchema = z.object({
  id: z.string().uuid(),
  consultant_id: z.string().uuid().nullable().optional(),
  consultant_extra_id: z.string().uuid().nullable().optional(),
  voltage: z.enum(["110v", "220v"]).nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  observations: z.string().trim().nullable().optional(),
  sale_channel: z.enum(SALE_CHANNELS).nullable().optional(),
  partner_store: z.string().trim().nullable().optional(),
  partner_seller_name: z.string().trim().nullable().optional(),
  partner_commission_percent: percentField,
  partner_store_id: partnerIdField,
  partner_seller_id: partnerIdField,
  partner_store_split_percent: percentField,
  partner_extra_name: z.string().trim().nullable().optional(),
  partner_extra_percent: percentField,
  ...addressSchema,
});

export async function updateServiceOrder(formData: FormData) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const parsed = updateSchema.parse({
    id: formData.get("id"),
    consultant_id: readForm(formData, "consultant_id") ?? null,
    consultant_extra_id: readForm(formData, "consultant_extra_id") ?? null,
    voltage: readForm(formData, "voltage") ?? null,
    deadline: readForm(formData, "deadline") ?? null,
    notes: readForm(formData, "notes") ?? null,
    observations: readForm(formData, "observations") ?? null,
    sale_channel: readForm(formData, "sale_channel") ?? null,
    partner_store: readForm(formData, "partner_store") ?? null,
    partner_seller_name: readForm(formData, "partner_seller_name") ?? null,
    partner_commission_percent: readForm(formData, "partner_commission_percent") ?? "",
    partner_store_id: readForm(formData, "partner_store_id") ?? "",
    partner_seller_id: readForm(formData, "partner_seller_id") ?? "",
    partner_store_split_percent: readForm(formData, "partner_store_split_percent") ?? "",
    partner_extra_name: readForm(formData, "partner_extra_name") ?? null,
    partner_extra_percent: readForm(formData, "partner_extra_percent") ?? "",
    address_street: readForm(formData, "address_street"),
    address_number: readForm(formData, "address_number"),
    address_complement: readForm(formData, "address_complement"),
    address_district: readForm(formData, "address_district"),
    address_city: readForm(formData, "address_city"),
    address_state: readForm(formData, "address_state"),
    address_cep: readForm(formData, "address_cep"),
  });

  const { error } = await supabase
    .from("service_orders")
    .update({
      consultant_id: parsed.consultant_id,
      consultant_extra_id: parsed.consultant_extra_id,
      voltage: parsed.voltage,
      deadline: parsed.deadline,
      notes: emptyToNull(parsed.notes),
      observations: emptyToNull(parsed.observations),
      sale_channel: parsed.sale_channel,
      partner_store: emptyToNull(parsed.partner_store),
      partner_seller_name: emptyToNull(parsed.partner_seller_name),
      partner_commission_percent: parsed.partner_commission_percent,
      partner_store_id: parsed.partner_store_id,
      partner_seller_id: parsed.partner_seller_id,
      partner_store_split_percent: parsed.partner_store_split_percent,
      partner_extra_name: emptyToNull(parsed.partner_extra_name),
      partner_extra_percent: parsed.partner_extra_percent,
      address_street: emptyToNull(parsed.address_street),
      address_number: emptyToNull(parsed.address_number),
      address_complement: emptyToNull(parsed.address_complement),
      address_district: emptyToNull(parsed.address_district),
      address_city: emptyToNull(parsed.address_city),
      address_state: emptyToNull(parsed.address_state),
      address_cep: emptyToNull(parsed.address_cep),
      // Endereco pode ter mudado: zera o geocode pra recalcular no roteiro.
      lat: null,
      lng: null,
      geocoded_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${parsed.id}`);
}

const scheduleSchema = z.object({
  id: z.string().uuid(),
  service_date: z.string().min(1),
  shift: z.enum(["manha", "tarde"]),
  technician_ids: z.array(z.string().uuid()).min(1, "Escolha ao menos um tecnico"),
  reason: z.string().trim().max(1000).optional(),
  // Horario exato pra grade da Agenda - opcional, o roteiro/mapa seguem
  // vivendo so de shift. Quando informado, scheduled_start_at manda no dia
  // (service_date pode ser derivado dele pelo chamador).
  scheduled_start_at: z.string().datetime().nullable().optional(),
  scheduled_end_at: z.string().datetime().nullable().optional(),
});

/** Agenda a OS num turno e aloca os tecnicos que vao na residencia. */
export async function scheduleServiceOrder(input: {
  id: string;
  service_date: string;
  shift: "manha" | "tarde";
  technician_ids: string[];
  reason?: string;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
}) {
  // Vendedora marca o horario da OS que ela mesma abriu (fechando a venda
  // com o cliente na linha) - remarcar/realocar depois segue com a gestao,
  // que e checado no fluxo de status.
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canCreateServiceOrder(ctx.role)) {
    throw new Error("Sem permissao para agendar ordem de servico");
  }
  const parsed = scheduleSchema.parse(input);
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("service_orders")
    .select("id, status, service_date, shift, scheduled_start_at, scheduled_end_at")
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readError) throw new Error(readError.message);

  const from = current.status as ServiceOrderStatus;
  const scheduleChanged =
    Boolean(current.service_date) &&
    (current.service_date !== parsed.service_date ||
      current.shift !== parsed.shift ||
      (current.scheduled_start_at ?? null) !== (parsed.scheduled_start_at ?? null));
  if (scheduleChanged && !parsed.reason) {
    throw new Error("Informe o motivo da remarcação");
  }
  // Reagendar uma OS ja agendada nao e transicao de status, so troca de data.
  const needsTransition = from !== "agendada";
  if (needsTransition && !canTransitionServiceOrder(from, "agendada")) {
    throw new Error(`Nao da pra agendar uma OS com status "${from}"`);
  }

  // Nova alocacao entra no fim da rota do turno; a ordem fina sai da
  // otimizacao (fase 2) ou do arrasto do ADM.
  const { data: lastInShift } = await supabase
    .from("service_orders")
    .select("route_position")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", parsed.service_date)
    .eq("shift", parsed.shift)
    .order("route_position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from("service_orders")
    .update({
      service_date: parsed.service_date,
      shift: parsed.shift,
      scheduled_start_at: parsed.scheduled_start_at ?? null,
      scheduled_end_at: parsed.scheduled_end_at ?? null,
      status: "agendada",
      route_position: ((lastInShift?.route_position as number | null) ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  await setServiceOrderTechniciansInternal(supabase, ctx, parsed.id, parsed.technician_ids);

  if (scheduleChanged) {
    const { error: historyError } = await supabase.from("service_order_schedule_history").insert({
      tenant_id: ctx.tenantId,
      service_order_id: parsed.id,
      previous_date: current.service_date,
      previous_shift: current.shift,
      new_date: parsed.service_date,
      new_shift: parsed.shift,
      reason: parsed.reason!,
      changed_by: ctx.userId,
    });
    if (historyError) throw new Error(historyError.message);

    await logStatusChange(
      supabase,
      ctx,
      parsed.id,
      from,
      "agendada",
      `Remarcada: ${parsed.reason}`,
    );
  }

  if (needsTransition) {
    await logStatusChange(
      supabase,
      ctx,
      parsed.id,
      from,
      "agendada",
      parsed.reason ? `OS reagendada: ${parsed.reason}` : "OS agendada",
    );
  }

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath("/os/roteiro");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${parsed.id}`);
}

/** Confirma com o cliente que a visita vai acontecer - so muda a cor do
 * card na Agenda, nao e transicao de status (o sistema antigo do ACT ja
 * tinha exatamente esse campo: "Contato" + "Data/Hora" da confirmacao). */
export async function confirmServiceOrder(input: { id: string; contact_name?: string }) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_orders")
    .update({
      confirmed_at: new Date().toISOString(),
      confirmed_by: ctx.userId,
      confirmed_contact_name: input.contact_name?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/os/agenda");
  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${input.id}`);
}

export async function unconfirmServiceOrder(input: { id: string }) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_orders")
    .update({
      confirmed_at: null,
      confirmed_by: null,
      confirmed_contact_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/os/agenda");
  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${input.id}`);
}

/** Marca/desmarca uma pendencia visivel na Agenda (card fica vermelho), sem
 * mexer no status - "problema" e um alerta visual, nao um estado da OS. */
export async function setServiceOrderPendingIssue(input: {
  id: string;
  has_pending_issue: boolean;
  note?: string;
}) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_orders")
    .update({
      has_pending_issue: input.has_pending_issue,
      pending_issue_note: input.has_pending_issue ? input.note?.trim() || null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/os/agenda");
  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${input.id}`);
}

async function setServiceOrderTechniciansInternal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: Ctx,
  orderId: string,
  technicianIds: string[],
) {
  const unique = [...new Set(technicianIds)];

  const { error: deleteError } = await supabase
    .from("service_order_technicians")
    .delete()
    .eq("service_order_id", orderId)
    .eq("tenant_id", ctx.tenantId);
  if (deleteError) throw new Error(deleteError.message);

  if (unique.length === 0) return;

  const { error } = await supabase.from("service_order_technicians").insert(
    unique.map((userId, index) => ({
      tenant_id: ctx.tenantId,
      service_order_id: orderId,
      user_id: userId,
      is_primary: index === 0,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function setServiceOrderTechnicians(input: { id: string; technician_ids: string[] }) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();
  await setServiceOrderTechniciansInternal(supabase, ctx, input.id, input.technician_ids);
  revalidatePath("/os/roteiro");
  revalidatePath(`/os/${input.id}`);
}

const transitionSchema = z.object({
  id: z.string().uuid(),
  to: z.enum([
    "rascunho",
    "agendada",
    "em_execucao",
    "concluida",
    "conferida",
    "faturada",
    "cancelada",
    "remarcada",
    "assistencia",
  ]),
  reason: z.string().trim().optional(),
});

export type CommissionPreviewLine = {
  partyKind: CommissionParty;
  userId: string | null;
  partnerId: string | null;
  partnerName: string | null;
  partnerStore: string | null;
  baseCents: number;
  percent: number;
  amountCents: number;
};

/**
 * O que "Faturar" vai gerar, ANTES de gerar - pra ninguem clicar sem saber
 * pra quem o dinheiro vai (foi exatamente o que faltou quando a comissao do
 * Matheus saiu sem ninguem esperar).
 *
 * Chama a mesma function do Postgres que bill_service_order usa pra gravar
 * (compute_service_order_commissions), so que essa aqui so LE. Preview e
 * faturamento sao, por construcao, a mesma conta - nao existe as duas
 * divergindo.
 */
export async function previewServiceOrderCommissions(
  serviceOrderId: string,
): Promise<CommissionPreviewLine[]> {
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canReviewServiceOrder(ctx.role)) {
    throw new Error("Só a gestão pode faturar a OS");
  }
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("compute_service_order_commissions", {
    p_service_order_id: serviceOrderId,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    out_party_kind: CommissionParty;
    out_user_id: string | null;
    out_partner_id: string | null;
    out_partner_name: string | null;
    out_partner_store: string | null;
    out_base_cents: number;
    out_percent: number;
    out_amount_cents: number;
  }>;

  const userIds = [...new Set(rows.map((r) => r.out_user_id).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) nameById.set(p.id, p.full_name);
    }
  }

  return rows.map((r) => ({
    partyKind: r.out_party_kind,
    userId: r.out_user_id,
    partnerId: r.out_partner_id,
    partnerName: r.out_user_id ? (nameById.get(r.out_user_id) ?? null) : r.out_partner_name,
    partnerStore: r.out_partner_store,
    baseCents: r.out_base_cents,
    percent: Number(r.out_percent),
    amountCents: r.out_amount_cents,
  }));
}

/** Faturamento com comissao ajustada manualmente pelo admin no modal - cada
 * linha do preview pode ter o valor alterado antes de confirmar. */
export async function billServiceOrderWithOverrides(input: {
  serviceOrderId: string;
  lines: CommissionPreviewLine[];
}) {
  const ctx = await requireFieldServiceContext();
  if (!canReviewServiceOrder(ctx.role)) throw new Error("Só a gestão pode faturar a OS");
  const supabase = await createClient();

  const overrides = input.lines.map((l) => ({
    party_kind: l.partyKind,
    user_id: l.userId,
    partner_id: l.partnerId,
    partner_name: l.partnerName,
    partner_store: l.partnerStore,
    base_cents: l.baseCents,
    percent: l.percent,
    amount_cents: l.amountCents,
  }));

  const { error } = await supabase.rpc("bill_service_order", {
    p_service_order_id: input.serviceOrderId,
    p_user_id: ctx.userId,
    p_overrides: overrides,
  });
  if (error) throw new Error(error.message);
  await routeLeadToReapplicationFolder(supabase, ctx.tenantId, input.serviceOrderId);

  revalidatePath(`/os/${input.serviceOrderId}`);
  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath("/os/roteiro");
  revalidatePath("/financeiro");
  revalidatePath("/pastas");
}

export async function transitionServiceOrder(input: {
  id: string;
  to: ServiceOrderStatus;
  reason?: string;
}) {
  const ctx = await requireFieldServiceContext();
  const parsed = transitionSchema.parse(input);
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("service_orders")
    .select("id, status, service_date, shift")
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readError) throw new Error(readError.message);

  const from = current.status as ServiceOrderStatus;
  if (!canTransitionServiceOrder(from, parsed.to)) {
    throw new Error(`Transicao invalida: ${from} -> ${parsed.to}`);
  }

  if (parsed.to === "remarcada") {
    if (!canManageServiceOrders(ctx.role)) {
      throw new Error("A remarcação é feita pelo escritório");
    }
    if (!parsed.reason) {
      throw new Error("Informe o motivo da remarcação");
    }
  }

  const reopening =
    (from === "concluida" && parsed.to === "em_execucao") ||
    (from === "conferida" && parsed.to === "concluida") ||
    (from === "assistencia" && parsed.to === "em_execucao");
  if (reopening) {
    if (!canReopenServiceOrder(ctx.role)) {
      throw new Error("Só a gestão pode reabrir ou cancelar uma finalização");
    }
    if (!parsed.reason) {
      throw new Error("Informe o motivo da reabertura");
    }
  }

  // Conferencia e faturamento sao da gestao, nao do tecnico nem da vendedora.
  if ((parsed.to === "conferida" || parsed.to === "faturada") && !canReviewServiceOrder(ctx.role)) {
    throw new Error("Só a gestão pode conferir e faturar a OS");
  }

  // Faturar nao e so mudar o status: gera o lancamento a receber e as
  // comissoes. Isso roda numa funcao do Postgres pra ser tudo-ou-nada - meio
  // caminho aqui deixaria comissao sem faturamento no fechamento do mes.
  if (parsed.to === "faturada") {
    const { error: billError } = await supabase.rpc("bill_service_order", {
      p_service_order_id: parsed.id,
      p_user_id: ctx.userId,
    });
    if (billError) throw new Error(billError.message);
    await routeLeadToReapplicationFolder(supabase, ctx.tenantId, parsed.id);

    revalidatePath("/os");
    revalidatePath("/os/agenda");
    revalidatePath("/os/roteiro");
    revalidatePath("/financeiro");
    revalidatePath(`/os/${parsed.id}`);
    revalidatePath("/pastas");
    return;
  }

  const patch: Database["public"]["Tables"]["service_orders"]["Update"] = {
    status: parsed.to,
    updated_at: new Date().toISOString(),
  };
  if (parsed.to === "concluida") patch.completed_at = new Date().toISOString();
  if (parsed.to === "conferida") {
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = ctx.userId;
  }
  // Remarcacao devolve a OS pra fila: perde data, turno, horario e
  // confirmacao anterior - a agenda nova vai ler isso pra listar a OS na
  // coluna "Remarcar".
  if (parsed.to === "remarcada") {
    patch.service_date = null;
    patch.shift = null;
    patch.route_position = null;
    patch.scheduled_start_at = null;
    patch.scheduled_end_at = null;
    patch.confirmed_at = null;
    patch.confirmed_by = null;
    patch.confirmed_contact_name = null;
  }

  const { error } = await supabase
    .from("service_orders")
    .update(patch)
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  if (parsed.to === "remarcada" && current.service_date) {
    const { error: historyError } = await supabase.from("service_order_schedule_history").insert({
      tenant_id: ctx.tenantId,
      service_order_id: parsed.id,
      previous_date: current.service_date,
      previous_shift: current.shift,
      new_date: null,
      new_shift: null,
      reason: parsed.reason!,
      changed_by: ctx.userId,
    });
    if (historyError) throw new Error(historyError.message);
  }

  await logStatusChange(supabase, ctx, parsed.id, from, parsed.to, parsed.reason);

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath("/os/roteiro");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${parsed.id}`);
}

export async function cancelServiceOrderClosure(input: {
  id: string;
  reason: string;
}) {
  const ctx = await requireFieldServiceContext();
  if (!canReopenServiceOrder(ctx.role)) {
    throw new Error("Só a gestão pode cancelar uma finalização");
  }
  const parsed = z
    .object({
      id: z.string().uuid(),
      reason: z.string().trim().min(3).max(1000),
    })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_service_order_closure", {
    p_service_order_id: parsed.id,
    p_user_id: ctx.userId,
    p_reason: parsed.reason,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath("/os/roteiro");
  revalidatePath(`/os/${parsed.id}`);
}

const quoteConversionSchema = z.object({
  quote_id: z.string().uuid(),
  amount: z.number().min(0).nullable().optional(),
});

/** Transforma o orcamento feito em campo em outra OS ligada ao historico. */
export async function convertServiceOrderQuote(input: {
  quote_id: string;
  amount?: number | null;
}): Promise<string> {
  const ctx = await requireManagerContext();
  const parsed = quoteConversionSchema.parse(input);
  const supabase = await createClient();

  if (parsed.amount != null) {
    const { error: amountError } = await supabase
      .from("service_order_quotes")
      .update({
        amount_cents: Math.round(parsed.amount * 100),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.quote_id)
      .eq("tenant_id", ctx.tenantId);
    if (amountError) throw new Error(amountError.message);
  }

  const { data, error } = await supabase.rpc("convert_service_order_quote", {
    p_quote_id: parsed.quote_id,
    p_user_id: ctx.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("A nova OS não foi criada");

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${data}`);
  return data as string;
}

export async function cancelServiceOrderQuote(input: { quote_id: string }) {
  const ctx = await requireManagerContext();
  const parsed = z.object({ quote_id: z.string().uuid() }).parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_order_quotes")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", parsed.quote_id)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pendente");
  if (error) throw new Error(error.message);

  revalidatePath("/os");
  revalidatePath("/os/agenda");
}

const settlementSchema = z.object({
  service_order_id: z.string().uuid(),
  expected: z.number().min(0),
  received: z.number().min(0),
  payment_method: z.string().trim().max(100).nullable(),
  reason: z.string().trim().max(1000).optional(),
});

export type SettlementSaveResult = { pendingApproval: boolean };

/**
 * Acerto da OS. Antes do faturamento salva direto; depois de qualquer
 * lancamento vira solicitacao auditada para um owner liberar.
 */
export async function saveServiceOrderSettlement(input: {
  service_order_id: string;
  expected: number;
  received: number;
  payment_method: string | null;
  reason?: string;
}): Promise<SettlementSaveResult> {
  const ctx = await requireFieldServiceContext();
  if (!canReviewServiceOrder(ctx.role)) {
    throw new Error("Só a gestão financeira pode alterar o acerto da OS");
  }
  const parsed = settlementSchema.parse(input);
  const expectedCents = Math.round(parsed.expected * 100);
  const receivedCents = Math.round(parsed.received * 100);
  const supabase = await createClient();

  if (parsed.payment_method) {
    const { data: rate } = await supabase
      .from("payment_method_rates")
      .select("installment_count, minimum_installment_cents")
      .eq("tenant_id", ctx.tenantId)
      .ilike("name", parsed.payment_method)
      .eq("is_active", true)
      .maybeSingle();
    if (rate) {
      const installmentCount = Math.max(1, rate.installment_count);
      if (
        rate.minimum_installment_cents > 0 &&
        Math.floor(expectedCents / installmentCount) < rate.minimum_installment_cents
      ) {
        throw new Error(
          `O valor não atende à parcela mínima desta forma de pagamento (${formatCurrencyBRL(rate.minimum_installment_cents)}).`,
        );
      }
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("service_orders")
    .select("id, status, expected_receipt_cents, received_cents, payment_method")
    .eq("id", parsed.service_order_id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (orderError) throw new Error(orderError.message);

  const [{ data: paidEntries }, { data: paidCommissions }] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("service_order_id", parsed.service_order_id)
      .eq("status", "paga")
      .limit(1),
    supabase
      .from("commissions")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("service_order_id", parsed.service_order_id)
      .eq("status", "paga")
      .limit(1),
  ]);

  const locked =
    order.status === "faturada" ||
    Boolean(paidEntries?.length) ||
    Boolean(paidCommissions?.length);

  if (locked) {
    if (!parsed.reason) {
      throw new Error("Informe o motivo da alteração para solicitar a liberação de um dono");
    }
    const { error } = await supabase.from("financial_adjustment_requests").insert({
      tenant_id: ctx.tenantId,
      service_order_id: parsed.service_order_id,
      adjustment_kind: "acerto_os",
      payload: {
        expected_receipt_cents: expectedCents,
        received_cents: receivedCents,
        payment_method: parsed.payment_method,
        previous: {
          expected_receipt_cents: order.expected_receipt_cents,
          received_cents: order.received_cents,
          payment_method: order.payment_method,
        },
      },
      reason: parsed.reason,
      requested_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/os/${parsed.service_order_id}`);
    revalidatePath("/financeiro");
    return { pendingApproval: true };
  }

  const { error } = await supabase
    .from("service_orders")
    .update({
      expected_receipt_cents: expectedCents,
      received_cents: receivedCents,
      payment_method: parsed.payment_method || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.service_order_id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${parsed.service_order_id}`);
  return { pendingApproval: false };
}

export async function reviewFinancialAdjustment(input: {
  request_id: string;
  approve: boolean;
}) {
  const ctx = await requireFieldServiceContext();
  if (ctx.role !== "owner") {
    throw new Error("Somente um dos donos pode liberar esta alteração");
  }
  const parsed = z
    .object({ request_id: z.string().uuid(), approve: z.boolean() })
    .parse(input);
  const supabase = await createClient();

  if (parsed.approve) {
    const { error } = await supabase.rpc("approve_financial_adjustment", {
      p_request_id: parsed.request_id,
      p_user_id: ctx.userId,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("financial_adjustment_requests")
      .update({
        status: "recusado",
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", parsed.request_id)
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "pendente");
    if (error) throw new Error(error.message);
  }

  revalidatePath("/financeiro");
  revalidatePath("/os");
  revalidatePath("/os/agenda");
}

const itemSchema = z.object({
  service_order_id: z.string().uuid(),
  catalog_item_id: z.string().uuid().nullable(),
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  table_price: z.number().min(0).nullable(),
  discount_reason: z.string().trim().max(500).nullable(),
  kind: z.enum(["original", "upsell"]),
});

export async function addServiceOrderItem(formData: FormData) {
  const ctx = await requireFieldServiceContext();
  const supabase = await createClient();

  const parsed = itemSchema.parse({
    service_order_id: formData.get("service_order_id"),
    catalog_item_id: readForm(formData, "catalog_item_id") ?? null,
    description: formData.get("description"),
    quantity: Number(formData.get("quantity") ?? 1),
    unit_price: Number(formData.get("unit_price") ?? 0),
    table_price: readForm(formData, "table_price") ? Number(formData.get("table_price")) : null,
    discount_reason: readForm(formData, "discount_reason") ?? null,
    kind: formData.get("kind") ?? "original",
  });

  let description = parsed.description;
  let tablePriceCents =
    parsed.table_price == null ? null : Math.round(parsed.table_price * 100);

  if (parsed.catalog_item_id) {
    const { data: catalogItem, error: catalogError } = await supabase
      .from("service_catalog_items")
      .select("name, price_cents, is_active")
      .eq("id", parsed.catalog_item_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (catalogError) throw new Error(catalogError.message);
    if (!catalogItem?.is_active) throw new Error("O item da tabela não está mais disponível");
    description = catalogItem.name;
    tablePriceCents = catalogItem.price_cents;
  }

  const unitPriceCents = Math.round(parsed.unit_price * 100);
  const amountCents = Math.round(unitPriceCents * parsed.quantity);

  if (tablePriceCents != null && unitPriceCents > tablePriceCents) {
    throw new Error("O valor negociado nao pode ser maior que o valor de tabela.");
  }

  // Upsell lancado em campo entra pendente: so soma no total da OS depois que
  // o ADM aprova na conferencia.
  const approved = parsed.kind === "original";
  const hasDiscount = parsed.kind === "original" && tablePriceCents != null && unitPriceCents < tablePriceCents;

  const { error } = await supabase.from("service_order_items").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    catalog_item_id: parsed.catalog_item_id,
    description,
    quantity: parsed.quantity,
    unit_price_cents: unitPriceCents,
    amount_cents: amountCents,
    kind: parsed.kind,
    approved,
    table_price_cents: tablePriceCents,
    discount_status: hasDiscount ? "solicitado" : "nao_aplicavel",
    discount_requested_by: hasDiscount ? ctx.userId : null,
    discount_requested_at: hasDiscount ? new Date().toISOString() : null,
    discount_reason: hasDiscount ? parsed.discount_reason : null,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${parsed.service_order_id}`);
}

/** Aprovacao/rejeicao do upsell na conferencia do ADM. */
export async function setServiceOrderItemApproved(input: { item_id: string; approved: boolean }) {
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canReviewServiceOrder(ctx.role)) throw new Error("Só a gestão pode aprovar itens");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_order_items")
    .update({ approved: input.approved })
    .eq("id", input.item_id)
    .eq("tenant_id", ctx.tenantId)
    .select("service_order_id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${data.service_order_id}`);
}

/** Gerencia decide uma solicitacao de desconto da vendedora. */
export async function reviewServiceOrderItemDiscount(input: {
  item_id: string;
  approved: boolean;
}) {
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canApproveServiceOrderDiscount(ctx.role)) {
    throw new Error("So a gerencia pode aprovar desconto");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_order_items")
    .update({
      discount_status: input.approved ? "aprovado" : "recusado",
      discount_reviewed_by: ctx.userId,
      discount_reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.item_id)
    .eq("tenant_id", ctx.tenantId)
    .eq("discount_status", "solicitado")
    .select("service_order_id")
    .single();
  if (error) throw new Error(error.message);

  // O trigger da tabela recalcula o total quando o status muda.
  revalidatePath(`/os/${data.service_order_id}`);
}

const travelFeeSchema = z.object({
  service_order_id: z.string().uuid(),
  value: z.number().min(0).max(1_000_000),
});

/** Deslocamento e cobrado separado dos itens, mas compoe o total da OS. */
export async function setServiceOrderTravelFee(input: { service_order_id: string; value: number }) {
  const ctx = await requireFieldServiceContext();
  const parsed = travelFeeSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_orders")
    .update({
      travel_fee_cents: Math.round(parsed.value * 100),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.service_order_id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/os/${parsed.service_order_id}`);
}

export async function deleteServiceOrderItem(input: { item_id: string }) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const { data: item, error: readError } = await supabase
    .from("service_order_items")
    .select("service_order_id")
    .eq("id", input.item_id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await supabase
    .from("service_order_items")
    .delete()
    .eq("id", input.item_id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${item.service_order_id}`);
}

/** Reordena as paradas do turno (arrasto do ADM na tela de roteiro). */
export async function reorderShiftRoute(input: { ordered_ids: string[] }) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  for (const [index, id] of input.ordered_ids.entries()) {
    const { error } = await supabase
      .from("service_orders")
      .update({ route_position: index + 1, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/os/roteiro");
}

/**
 * Reaplicacao: quando um servico (normalmente impermeabilizacao) precisa de
 * retorno. Nao e tratada como venda nova nem reaproveita a OS antiga - nasce
 * uma OS propria, em rascunho, com o mesmo cliente/endereco/parceiro da
 * origem, referenciando-a via origin_service_order_id + origin_kind, do
 * mesmo jeito que ja existe pra orcamento convertido (so muda o motivo).
 * Copia os itens originais como ponto de partida (o ADM ajusta o que for
 * preciso), sem copiar valores de upsell nem o financeiro ja fechado.
 */
export async function createReapplicationServiceOrder(input: { originServiceOrderId: string }) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const { data: origin, error: originError } = await supabase
    .from("service_orders")
    .select("*")
    .eq("id", input.originServiceOrderId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (originError) throw new Error(originError.message);

  const { data: originItems } = await supabase
    .from("service_order_items")
    .select("description, quantity, unit_price_cents, amount_cents, kind, catalog_item_id, table_price_cents")
    .eq("service_order_id", input.originServiceOrderId)
    .eq("tenant_id", ctx.tenantId)
    .eq("kind", "original");

  const order = await insertWithSequentialCode(supabase, ctx.tenantId, {
    lead_id: origin.lead_id,
    consultant_id: origin.consultant_id,
    consultant_extra_id: origin.consultant_extra_id,
    created_by: ctx.userId,
    status: "rascunho",
    voltage: origin.voltage,
    sale_channel: origin.sale_channel,
    partner_store: origin.partner_store,
    partner_seller_name: origin.partner_seller_name,
    partner_commission_percent: origin.partner_commission_percent,
    partner_store_id: origin.partner_store_id,
    partner_seller_id: origin.partner_seller_id,
    partner_store_split_percent: origin.partner_store_split_percent,
    partner_extra_name: origin.partner_extra_name,
    partner_extra_percent: origin.partner_extra_percent,
    address_street: origin.address_street,
    address_number: origin.address_number,
    address_complement: origin.address_complement,
    address_district: origin.address_district,
    address_city: origin.address_city,
    address_state: origin.address_state,
    address_cep: origin.address_cep,
    origin_service_order_id: origin.id,
    origin_kind: "reaplicacao",
    observations: `Reaplicação referente a OS-${String(origin.code_seq).padStart(4, "0")}.`,
  });

  if (originItems && originItems.length > 0) {
    const { error: itemsError } = await supabase.from("service_order_items").insert(
      originItems.map((item) => ({
        tenant_id: ctx.tenantId,
        service_order_id: order.id,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        amount_cents: item.amount_cents,
        kind: "original" as const,
        catalog_item_id: item.catalog_item_id,
        table_price_cents: item.table_price_cents,
        approved: true,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  await logStatusChange(
    supabase,
    ctx,
    order.id,
    null,
    "rascunho",
    `Reaplicação criada a partir de OS-${String(origin.code_seq).padStart(4, "0")}`,
  );

  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath(`/os/${input.originServiceOrderId}`);
  return order.id;
}

const followupSchema = z.object({
  service_order_id: z.string().uuid(),
  category: z.string().trim().min(1, "Informe a categoria"),
  responsible_id: z.string().uuid().nullable().optional(),
  contact_date: z.string().min(1, "Informe a data"),
  description: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** Proximo contato comercial gerado a partir de uma OS - ex: "fez lavagem,
 * oferecer impermeabilizacao daqui 30 dias". Fica ligado a OS de origem,
 * nao alimenta nenhum outro modulo por enquanto (so listagem/consulta). */
export async function createServiceOrderFollowup(input: {
  service_order_id: string;
  category: string;
  responsible_id?: string | null;
  contact_date: string;
  description?: string;
  notes?: string;
}) {
  const ctx = await requireManagerContext();
  const parsed = followupSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("service_order_followups").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    category: parsed.category,
    responsible_id: parsed.responsible_id || null,
    contact_date: parsed.contact_date,
    description: emptyToNull(parsed.description),
    notes: emptyToNull(parsed.notes),
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${parsed.service_order_id}`);
}

export async function setServiceOrderFollowupStatus(input: {
  id: string;
  service_order_id: string;
  status: "pendente" | "feito" | "cancelado";
}) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("service_order_followups")
    .update({ status: input.status })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${input.service_order_id}`);
}

/** Pede ajuste manual do valor de uma comissao ja calculada (ex: acordo
 * verbal diferente do percentual padrao). O banco ja sabia tratar
 * adjustment_kind='comissao' (approve_financial_adjustment) desde a fase de
 * resumo de comissao - so faltava um jeito de pedir isso pela tela. So o
 * dono aprova, igual todo ajuste pos-faturamento. */
export async function requestCommissionAdjustment(input: {
  commission_id: string;
  service_order_id: string;
  new_amount_cents: number;
  reason: string;
}) {
  const ctx = await requireFieldServiceContext();
  if (!canReviewServiceOrder(ctx.role)) {
    throw new Error("Só a gestão pode pedir ajuste de comissão");
  }
  const parsed = z
    .object({
      commission_id: z.string().uuid(),
      service_order_id: z.string().uuid(),
      new_amount_cents: z.number().int().min(0),
      reason: z.string().trim().min(1, "Informe o motivo"),
    })
    .parse(input);
  const supabase = await createClient();

  const { error } = await supabase.from("financial_adjustment_requests").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    commission_id: parsed.commission_id,
    adjustment_kind: "comissao",
    payload: { amount_cents: parsed.new_amount_cents },
    reason: parsed.reason,
    requested_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/os/${parsed.service_order_id}`);
  revalidatePath("/financeiro");
}

export type TechnicianDayAvailability = {
  technicianId: string;
  technicianName: string;
  busy: Array<{ startAt: string; endAt: string; leadName: string }>;
};

/**
 * Agenda do dia por tecnico, so o suficiente pra vendedora ver o horario
 * livre na hora de fechar a venda pelo chat - sem abrir a Agenda inteira
 * (que e operacao de campo e ela nao acessa).
 */
export async function getTechnicianDayAvailability(day: string): Promise<TechnicianDayAvailability[]> {
  const ctx = await requireContext();
  assertFieldServiceEnabled(ctx);
  if (!canCreateServiceOrder(ctx.role)) {
    throw new Error("Sem permissao para ver a agenda dos tecnicos");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data invalida");

  const supabase = await createClient();
  const technicians = await listTechnicians(ctx.tenantId);
  if (technicians.length === 0) return [];

  const { data: orders } = await supabase
    .from("service_orders")
    .select("id, scheduled_start_at, scheduled_end_at, shift, service_date, status, leads(name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", day)
    .not("status", "in", "(cancelada)");

  const rows = (orders ?? []) as Array<{
    id: string;
    scheduled_start_at: string | null;
    scheduled_end_at: string | null;
    leads: { name: string | null } | null;
  }>;

  const { data: assignments } = rows.length
    ? await supabase
        .from("service_order_technicians")
        .select("service_order_id, user_id")
        .in("service_order_id", rows.map((r) => r.id))
    : { data: [] };

  const byOrder = new Map(rows.map((r) => [r.id, r]));
  const busyByTech = new Map<string, TechnicianDayAvailability["busy"]>();
  for (const a of (assignments ?? []) as Array<{ service_order_id: string; user_id: string }>) {
    const order = byOrder.get(a.service_order_id);
    if (!order?.scheduled_start_at || !order.scheduled_end_at) continue;
    const list = busyByTech.get(a.user_id) ?? [];
    list.push({
      startAt: order.scheduled_start_at,
      endAt: order.scheduled_end_at,
      leadName: order.leads?.name ?? "Cliente",
    });
    busyByTech.set(a.user_id, list);
  }

  return technicians.map((tech) => ({
    technicianId: tech.id,
    technicianName: tech.name,
    busy: (busyByTech.get(tech.id) ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt)),
  }));
}

const updateAtendimentoSchema = z.object({
  lead_name: z.string().trim().min(1, "Nome obrigatorio").optional(),
  lead_phone: z.string().trim().optional(),
  consultant_id: z.string().uuid().optional(),
  consultant_extra_id: z.string().uuid().optional(),
  voltage: z.enum(["110v", "220v"]).optional(),
  deadline: z.string().optional(),
  sale_channel: z.enum(SALE_CHANNELS).optional(),
  partner_store: z.string().trim().optional(),
  partner_extra_name: z.string().trim().optional(),
  partner_extra_percent: percentField,
  technician_ids: z.string().optional(),
  ...addressSchema,
});

/**
 * "Tela da OS totalmente editavel" - pedido do ACT depois de ver que so
 * dava pra corrigir nome/telefone abrindo o lead em outra tela, e voltagem/
 * endereco/consultora nem isso. Um so form corrige tudo que foi digitado
 * errado na hora da venda, sem duplicar campo em duas telas.
 */
export async function updateServiceOrderAtendimento(input: {
  id: string;
  formData: FormData;
}) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();
  const formData = input.formData;

  const parsed = updateAtendimentoSchema.parse({
    lead_name: readForm(formData, "lead_name"),
    lead_phone: readForm(formData, "lead_phone"),
    consultant_id: readForm(formData, "consultant_id"),
    consultant_extra_id: readForm(formData, "consultant_extra_id"),
    voltage: readForm(formData, "voltage"),
    deadline: readForm(formData, "deadline"),
    sale_channel: readForm(formData, "sale_channel"),
    partner_store: readForm(formData, "partner_store"),
    partner_extra_name: readForm(formData, "partner_extra_name"),
    partner_extra_percent: readForm(formData, "partner_extra_percent") ?? "",
    technician_ids: readForm(formData, "technician_ids"),
    address_street: readForm(formData, "address_street"),
    address_number: readForm(formData, "address_number"),
    address_complement: readForm(formData, "address_complement"),
    address_district: readForm(formData, "address_district"),
    address_city: readForm(formData, "address_city"),
    address_state: readForm(formData, "address_state"),
    address_cep: readForm(formData, "address_cep"),
  });

  const { data: order } = await supabase
    .from("service_orders")
    .select("lead_id")
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!order) throw new Error("OS nao encontrada");

  if ((parsed.lead_name || parsed.lead_phone) && order.lead_id) {
    const { error: leadError } = await supabase
      .from("leads")
      .update({
        ...(parsed.lead_name ? { name: parsed.lead_name } : {}),
        ...(parsed.lead_phone !== undefined ? { phone: parsed.lead_phone || null } : {}),
      })
      .eq("id", order.lead_id)
      .eq("tenant_id", ctx.tenantId);
    if (leadError) throw new Error(leadError.message);
  }

  const { error } = await supabase
    .from("service_orders")
    .update({
      voltage: parsed.voltage ?? null,
      deadline: parsed.deadline || null,
      sale_channel: parsed.sale_channel ?? null,
      partner_store: parsed.partner_store || null,
      partner_extra_name: parsed.partner_extra_name || null,
      partner_extra_percent: parsed.partner_extra_percent,
      consultant_id: parsed.consultant_id ?? null,
      consultant_extra_id: parsed.consultant_extra_id ?? null,
      address_street: parsed.address_street || null,
      address_number: parsed.address_number || null,
      address_complement: parsed.address_complement || null,
      address_district: parsed.address_district || null,
      address_city: parsed.address_city || null,
      address_state: parsed.address_state || null,
      address_cep: parsed.address_cep || null,
    })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  if (parsed.technician_ids !== undefined) {
    const ids = parsed.technician_ids ? parsed.technician_ids.split(",").filter(Boolean) : [];
    await setServiceOrderTechniciansInternal(supabase, ctx, input.id, ids);
  }

  revalidatePath(`/os/${input.id}`);
  revalidatePath("/os");
  revalidatePath("/os/agenda");
  revalidatePath("/os/roteiro");
}
