"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canTransitionServiceOrder } from "@/lib/field-service/status";
import { isWithinTrackingWindow } from "@/lib/field-service/tracking-window";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";

type Ctx = Awaited<ReturnType<typeof requireContext>>;

/**
 * Contexto do app de campo. Nao restringe ao papel "tecnico" de proposito:
 * dono e gerente as vezes vao junto na residencia e precisam da mesma tela.
 * Quem filtra o que cada um enxerga e a RLS de service_orders.
 */
async function requireFieldContext(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) {
    throw new Error("Modulo de servico em campo desativado para esta empresa");
  }
  return ctx;
}

/** Confirma que a OS existe e e visivel pra esse usuario (a RLS decide). */
async function requireVisibleOrder(ctx: Ctx, orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("OS nao encontrada ou sem acesso");
  return data;
}

export async function getFieldStoragePath(orderId: string): Promise<string> {
  const ctx = await requireFieldContext();
  await requireVisibleOrder(ctx, orderId);
  return `${ctx.tenantId}/${orderId}`;
}

const signatureSchema = z.object({
  service_order_id: z.string().uuid(),
  storage_path: z.string().min(1),
  signer_name: z.string().trim().min(1, "Informe quem assinou"),
});

/**
 * Registra a assinatura do cliente. O arquivo ja subiu direto do browser pro
 * bucket (mesmo fluxo do lead-files), aqui so gravamos o ponteiro.
 */
export async function saveSignature(input: {
  service_order_id: string;
  storage_path: string;
  signer_name: string;
}) {
  const ctx = await requireFieldContext();
  const parsed = signatureSchema.parse(input);
  await requireVisibleOrder(ctx, parsed.service_order_id);

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_orders")
    .update({
      signature_path: parsed.storage_path,
      signer_name: parsed.signer_name,
      signed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.service_order_id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/campo/${parsed.service_order_id}`);
  revalidatePath(`/os/${parsed.service_order_id}`);
}

const damageSchema = z.object({
  service_order_id: z.string().uuid(),
  description: z.string().trim().min(1),
  photo_path: z.string().nullable().optional(),
});

/** Avaria encontrada no estofado na chegada - o "recebido" que eles usam hoje. */
export async function addDamage(input: {
  service_order_id: string;
  description: string;
  photo_path?: string | null;
}) {
  const ctx = await requireFieldContext();
  const parsed = damageSchema.parse(input);
  await requireVisibleOrder(ctx, parsed.service_order_id);

  const supabase = await createClient();
  const { error } = await supabase.from("service_order_damages").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    description: parsed.description,
    photo_path: parsed.photo_path ?? null,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/campo/${parsed.service_order_id}`);
  revalidatePath(`/os/${parsed.service_order_id}`);
}

const fieldItemSchema = z.object({
  service_order_id: z.string().uuid(),
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
});

/**
 * Item vendido na residencia. Entra sempre como upsell nao aprovado: quem
 * libera e o ADM na conferencia, e e sobre esse valor que sai a comissao do
 * tecnico na fase 3.
 */
export async function addFieldUpsellItem(input: {
  service_order_id: string;
  description: string;
  quantity: number;
  unit_price: number;
}) {
  const ctx = await requireFieldContext();
  const parsed = fieldItemSchema.parse(input);
  await requireVisibleOrder(ctx, parsed.service_order_id);

  const unitPriceCents = Math.round(parsed.unit_price * 100);
  const supabase = await createClient();
  const { error } = await supabase.from("service_order_items").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    description: parsed.description,
    quantity: parsed.quantity,
    unit_price_cents: unitPriceCents,
    amount_cents: Math.round(unitPriceCents * parsed.quantity),
    kind: "upsell",
    approved: false,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/campo/${parsed.service_order_id}`);
  revalidatePath(`/os/${parsed.service_order_id}`);
}

const fieldTransitionSchema = z.object({
  service_order_id: z.string().uuid(),
  to: z.enum(["em_execucao", "concluida"]),
  reason: z.string().trim().optional(),
});

/**
 * Transicoes que o tecnico dispara em campo. O conjunto e fechado aqui de
 * proposito - conferir e faturar continuam sendo da gestao.
 */
export async function fieldTransition(input: {
  service_order_id: string;
  to: "em_execucao" | "concluida";
  reason?: string;
}) {
  const ctx = await requireFieldContext();
  const parsed = fieldTransitionSchema.parse(input);
  const current = await requireVisibleOrder(ctx, parsed.service_order_id);

  const from = current.status as ServiceOrderStatus;
  if (!canTransitionServiceOrder(from, parsed.to)) {
    throw new Error(`Nao da pra mudar de "${from}" para "${parsed.to}"`);
  }

  const supabase = await createClient();

  // Concluir exige assinatura: e o comprovante de execucao que a empresa
  // confere depois, e era o que o papel garantia antes.
  if (parsed.to === "concluida") {
    const { data: order } = await supabase
      .from("service_orders")
      .select("signed_at")
      .eq("id", parsed.service_order_id)
      .eq("tenant_id", ctx.tenantId)
      .single();
    if (!order?.signed_at) {
      throw new Error("Colete a assinatura do cliente antes de concluir a OS.");
    }
  }

  const patch: Record<string, unknown> = {
    status: parsed.to,
    updated_at: new Date().toISOString(),
  };
  if (parsed.to === "concluida") patch.completed_at = new Date().toISOString();
  const { error } = await supabase
    .from("service_orders")
    .update(patch)
    .eq("id", parsed.service_order_id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  await supabase.from("service_order_events").insert({
    tenant_id: ctx.tenantId,
    service_order_id: parsed.service_order_id,
    from_status: from,
    to_status: parsed.to,
    user_id: ctx.userId,
    reason: parsed.reason ?? null,
  });

  revalidatePath("/campo");
  revalidatePath(`/campo/${parsed.service_order_id}`);
  revalidatePath(`/os/${parsed.service_order_id}`);
  revalidatePath("/os/roteiro");
}

const fieldClosureSchema = z.object({
  service_order_id: z.string().uuid(),
  closure_type: z.enum(["finalizado", "finalizado_orcamento", "assistencia"]),
  answers: z.record(z.string(), z.boolean()),
  observations: z.string().trim().max(4000).optional(),
  quote_description: z.string().trim().max(4000).optional(),
});

/**
 * Fechamento unico do atendimento. O RPC grava laudo, resultado, eventual
 * orcamento e historico na mesma transacao.
 */
export async function closeFieldServiceOrder(input: {
  service_order_id: string;
  closure_type: "finalizado" | "finalizado_orcamento" | "assistencia";
  answers: Record<string, boolean>;
  observations?: string;
  quote_description?: string;
}) {
  const ctx = await requireFieldContext();
  const parsed = fieldClosureSchema.parse(input);
  await requireVisibleOrder(ctx, parsed.service_order_id);

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_service_order", {
    p_service_order_id: parsed.service_order_id,
    p_user_id: ctx.userId,
    p_closure_type: parsed.closure_type,
    p_answers: parsed.answers,
    p_observations: parsed.observations || null,
    p_quote_description: parsed.quote_description || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/campo");
  revalidatePath(`/campo/${parsed.service_order_id}`);
  revalidatePath("/os");
  revalidatePath(`/os/${parsed.service_order_id}`);
  revalidatePath("/os/roteiro");
}

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_meters: z.number().min(0).max(100000).nullable().optional(),
});

export type LocationShareResult =
  | { shared: true }
  | { shared: false; reason: "fora_do_horario" | "sem_os_hoje" };

/**
 * Recebe a posicao do tecnico. Guarda so a ultima (upsert), nunca o trajeto.
 *
 * Dois cortes, os dois no servidor porque o relogio do celular pode estar
 * errado ou ser burlado:
 *   1. Fora da janela de expediente, recusa.
 *   2. Sem OS pra hoje, recusa - nao ha finalidade em saber onde esta quem
 *      nao tem visita marcada.
 *
 * Devolver o motivo em vez de erro e de proposito: o app mostra pro tecnico
 * por que parou de compartilhar, em vez de falhar em silencio.
 */
export async function updateTechnicianLocation(input: {
  lat: number;
  lng: number;
  accuracy_meters?: number | null;
}): Promise<LocationShareResult> {
  const ctx = await requireFieldContext();
  const parsed = locationSchema.parse(input);

  if (!isWithinTrackingWindow()) {
    return { shared: false, reason: "fora_do_horario" };
  }

  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const { data: assignments } = await supabase
    .from("service_order_technicians")
    .select("service_order_id, service_orders!inner(service_date, status)")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.userId)
    .eq("service_orders.service_date", today)
    .in("service_orders.status", ["agendada", "em_execucao"])
    .limit(1);

  if (!assignments || assignments.length === 0) {
    return { shared: false, reason: "sem_os_hoje" };
  }

  const { error } = await supabase.from("technician_locations").upsert(
    {
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      lat: parsed.lat,
      lng: parsed.lng,
      accuracy_meters: parsed.accuracy_meters ?? null,
      recorded_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (error) throw new Error(error.message);

  return { shared: true };
}

/** Apaga a posicao. Chamado ao sair do expediente e no logout do tecnico. */
export async function clearTechnicianLocation() {
  const ctx = await requireFieldContext();
  const supabase = await createClient();
  await supabase
    .from("technician_locations")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", ctx.userId);
}
