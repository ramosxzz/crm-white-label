"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  canAccessServiceOrders,
  canManageServiceOrders,
  canReviewServiceOrder,
} from "@/lib/auth/roles";
import { canTransitionServiceOrder } from "@/lib/field-service/status";
import type { ServiceOrder, ServiceOrderStatus } from "@/lib/supabase/database.types";

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
  if (!canAccessServiceOrders(ctx.role) && ctx.role !== "tecnico") {
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

const createSchema = z.object({
  lead_id: z.string().uuid(),
  consultant_id: z.string().uuid().optional(),
  voltage: z.enum(["110v", "220v"]).optional(),
  deadline: z.string().optional(),
  notes: z.string().trim().optional(),
  observations: z.string().trim().optional(),
  partner_store: z.string().trim().optional(),
  partner_seller_name: z.string().trim().optional(),
  partner_commission_percent: percentField,
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
async function insertWithSequentialCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  payload: Record<string, unknown>,
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
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const parsed = createSchema.parse({
    lead_id: formData.get("lead_id"),
    consultant_id: readForm(formData, "consultant_id"),
    voltage: readForm(formData, "voltage"),
    deadline: readForm(formData, "deadline"),
    notes: readForm(formData, "notes"),
    observations: readForm(formData, "observations"),
    partner_store: readForm(formData, "partner_store"),
    partner_seller_name: readForm(formData, "partner_seller_name"),
    partner_commission_percent: readForm(formData, "partner_commission_percent") ?? "",
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
    created_by: ctx.userId,
    status: "rascunho",
    voltage: parsed.voltage ?? null,
    deadline: parsed.deadline ?? null,
    notes: emptyToNull(parsed.notes),
    observations: emptyToNull(parsed.observations),
    partner_store: emptyToNull(parsed.partner_store),
    partner_seller_name: emptyToNull(parsed.partner_seller_name),
    partner_commission_percent: parsed.partner_commission_percent,
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
  return order.id;
}

const updateSchema = z.object({
  id: z.string().uuid(),
  consultant_id: z.string().uuid().nullable().optional(),
  voltage: z.enum(["110v", "220v"]).nullable().optional(),
  deadline: z.string().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  observations: z.string().trim().nullable().optional(),
  partner_store: z.string().trim().nullable().optional(),
  partner_seller_name: z.string().trim().nullable().optional(),
  partner_commission_percent: percentField,
  ...addressSchema,
});

export async function updateServiceOrder(formData: FormData) {
  const ctx = await requireManagerContext();
  const supabase = await createClient();

  const parsed = updateSchema.parse({
    id: formData.get("id"),
    consultant_id: readForm(formData, "consultant_id") ?? null,
    voltage: readForm(formData, "voltage") ?? null,
    deadline: readForm(formData, "deadline") ?? null,
    notes: readForm(formData, "notes") ?? null,
    observations: readForm(formData, "observations") ?? null,
    partner_store: readForm(formData, "partner_store") ?? null,
    partner_seller_name: readForm(formData, "partner_seller_name") ?? null,
    partner_commission_percent: readForm(formData, "partner_commission_percent") ?? "",
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
      voltage: parsed.voltage,
      deadline: parsed.deadline,
      notes: emptyToNull(parsed.notes),
      observations: emptyToNull(parsed.observations),
      partner_store: emptyToNull(parsed.partner_store),
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
  revalidatePath(`/os/${parsed.id}`);
}

const scheduleSchema = z.object({
  id: z.string().uuid(),
  service_date: z.string().min(1),
  shift: z.enum(["manha", "tarde"]),
  technician_ids: z.array(z.string().uuid()).min(1, "Escolha ao menos um tecnico"),
});

/** Agenda a OS num turno e aloca os tecnicos que vao na residencia. */
export async function scheduleServiceOrder(input: {
  id: string;
  service_date: string;
  shift: "manha" | "tarde";
  technician_ids: string[];
}) {
  const ctx = await requireManagerContext();
  const parsed = scheduleSchema.parse(input);
  const supabase = await createClient();

  const { data: current, error: readError } = await supabase
    .from("service_orders")
    .select("id, status")
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readError) throw new Error(readError.message);

  const from = current.status as ServiceOrderStatus;
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
      status: "agendada",
      route_position: ((lastInShift?.route_position as number | null) ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  await setServiceOrderTechniciansInternal(supabase, ctx, parsed.id, parsed.technician_ids);

  if (needsTransition) {
    await logStatusChange(supabase, ctx, parsed.id, from, "agendada", "OS agendada");
  }

  revalidatePath("/os");
  revalidatePath("/os/roteiro");
  revalidatePath(`/os/${parsed.id}`);
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
  ]),
  reason: z.string().trim().optional(),
});

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
    .select("id, status")
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readError) throw new Error(readError.message);

  const from = current.status as ServiceOrderStatus;
  if (!canTransitionServiceOrder(from, parsed.to)) {
    throw new Error(`Transicao invalida: ${from} -> ${parsed.to}`);
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

    revalidatePath("/os");
    revalidatePath("/os/roteiro");
    revalidatePath("/financeiro");
    revalidatePath(`/os/${parsed.id}`);
    return;
  }

  const patch: Record<string, unknown> = {
    status: parsed.to,
    updated_at: new Date().toISOString(),
  };
  if (parsed.to === "concluida") patch.completed_at = new Date().toISOString();
  if (parsed.to === "conferida") {
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = ctx.userId;
  }
  // Remarcacao devolve a OS pra fila: perde data, turno e posicao na rota.
  if (parsed.to === "remarcada") {
    patch.service_date = null;
    patch.shift = null;
    patch.route_position = null;
  }

  const { error } = await supabase
    .from("service_orders")
    .update(patch)
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  await logStatusChange(supabase, ctx, parsed.id, from, parsed.to, parsed.reason);

  revalidatePath("/os");
  revalidatePath("/os/roteiro");
  revalidatePath(`/os/${parsed.id}`);
}

const itemSchema = z.object({
  service_order_id: z.string().uuid(),
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  kind: z.enum(["original", "upsell"]),
});

export async function addServiceOrderItem(formData: FormData) {
  const ctx = await requireFieldServiceContext();
  const supabase = await createClient();

  const parsed = itemSchema.parse({
    service_order_id: formData.get("service_order_id"),
    description: formData.get("description"),
    quantity: Number(formData.get("quantity") ?? 1),
    unit_price: Number(formData.get("unit_price") ?? 0),
    kind: formData.get("kind") ?? "original",
  });

  const unitPriceCents = Math.round(parsed.unit_price * 100);
  const amountCents = Math.round(unitPriceCents * parsed.quantity);

  // Upsell lancado em campo entra pendente: so soma no total da OS depois que
  // o ADM aprova na conferencia.
  const approved = parsed.kind === "original";

  const { error } = await supabase.from("service_order_items").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    description: parsed.description,
    quantity: parsed.quantity,
    unit_price_cents: unitPriceCents,
    amount_cents: amountCents,
    kind: parsed.kind,
    approved,
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
