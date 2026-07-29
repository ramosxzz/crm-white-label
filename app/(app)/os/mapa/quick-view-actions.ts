"use server";

import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders } from "@/lib/auth/roles";
import { formatServiceOrderCode } from "@/lib/field-service/status";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";

export type QuickViewItem = {
  id: string;
  description: string;
  quantity: number;
  amountCents: number;
  kind: "original" | "upsell";
  approved: boolean;
};

export type ServiceOrderQuickView = {
  id: string;
  code: string;
  status: ServiceOrderStatus;
  shift: "manha" | "tarde" | null;
  serviceDate: string | null;
  routePosition: number | null;
  leadName: string;
  leadPhone: string | null;
  address: string;
  cep: string | null;
  voltage: string | null;
  consultantName: string | null;
  technicianNames: string[];
  partnerStore: string | null;
  partnerSellerName: string | null;
  partnerCommissionPercent: number | null;
  observations: string | null;
  signerName: string | null;
  signedAt: string | null;
  items: QuickViewItem[];
  totalCents: number;
};

function joinAddress(order: Record<string, unknown>) {
  const street = [order.address_street, order.address_number].filter(Boolean).join(", ");
  return (
    [street, order.address_complement, order.address_district, order.address_city, order.address_state]
      .filter(Boolean)
      .join(" · ") || "Endereço não informado"
  );
}

/**
 * Detalhe da OS pra abrir num modal em cima do mapa, sem sair da tela.
 *
 * E leitura pura: o modal mostra e nao altera nada. Quem precisa agir na OS
 * continua indo pra pagina dela, que tem os botoes de transicao, conferencia e
 * faturamento.
 */
export async function getServiceOrderQuickView(orderId: string): Promise<ServiceOrderQuickView> {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) throw new Error("Módulo desativado para esta empresa");
  if (!canManageServiceOrders(ctx.role)) throw new Error("Sem permissão para ver esta OS");

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("service_orders")
    .select("*, leads(name, phone)")
    .eq("id", orderId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (error) throw new Error(error.message);

  const [{ data: items }, { data: assignments }] = await Promise.all([
    supabase
      .from("service_order_items")
      .select("id, description, quantity, amount_cents, kind, approved")
      .eq("service_order_id", orderId)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("service_order_technicians")
      .select("user_id, is_primary")
      .eq("service_order_id", orderId)
      .eq("tenant_id", ctx.tenantId)
      .order("is_primary", { ascending: false }),
  ]);

  // Nomes vem de profiles: cruzar user_id com nome exige o mesmo caminho que
  // o resto do modulo ja usa.
  const userIds = [
    ...new Set(
      [
        ...((assignments ?? []) as Array<{ user_id: string }>).map((a) => a.user_id),
        (order as Record<string, unknown>).consultant_id as string | null,
      ].filter(Boolean) as string[],
    ),
  ];

  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
      if (p.full_name) nameById.set(p.id, p.full_name);
    }
  }

  const row = order as Record<string, any>;

  return {
    id: row.id,
    code: formatServiceOrderCode(row.code_seq),
    status: row.status,
    shift: row.shift,
    serviceDate: row.service_date,
    routePosition: row.route_position,
    leadName: row.leads?.name ?? "Lead removido",
    leadPhone: row.leads?.phone ?? null,
    address: joinAddress(row),
    cep: row.address_cep,
    voltage: row.voltage,
    consultantName: row.consultant_id ? (nameById.get(row.consultant_id) ?? null) : null,
    technicianNames: ((assignments ?? []) as Array<{ user_id: string }>)
      .map((a) => nameById.get(a.user_id))
      .filter(Boolean) as string[],
    partnerStore: row.partner_store,
    partnerSellerName: row.partner_seller_name ?? null,
    partnerCommissionPercent: row.partner_commission_percent ?? null,
    observations: row.observations,
    signerName: row.signer_name,
    signedAt: row.signed_at,
    items: ((items ?? []) as any[]).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      amountCents: item.amount_cents,
      kind: item.kind,
      approved: item.approved,
    })),
    totalCents: row.total_cents ?? 0,
  };
}
