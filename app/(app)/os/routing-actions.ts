"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders } from "@/lib/auth/roles";
import { listTechnicians } from "@/lib/field-service/users";
import {
  buildAddressQuery,
  formatDistance,
  formatDuration,
  geocodeAddress,
  isRoutingEnabled,
  optimizeRoute,
  suggestBestTechnician,
  type LatLng,
} from "@/lib/field-service/routing";

type Ctx = Awaited<ReturnType<typeof requireContext>>;

async function requireRoutingContext(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) {
    throw new Error("Modulo de servico em campo desativado para esta empresa");
  }
  if (!canManageServiceOrders(ctx.role)) {
    throw new Error("Sem permissao para roteirizar");
  }
  return ctx;
}

export async function routingAvailable() {
  return isRoutingEnabled();
}

/** Ponto de partida do roteiro: endereco base da empresa, geocodificado uma vez. */
async function resolveBaseLocation(ctx: Ctx): Promise<LatLng | null> {
  if (ctx.tenant.field_service_base_lat != null && ctx.tenant.field_service_base_lng != null) {
    return { lat: ctx.tenant.field_service_base_lat, lng: ctx.tenant.field_service_base_lng };
  }
  if (!ctx.tenant.field_service_base_address) return null;

  const point = await geocodeAddress(ctx.tenant.field_service_base_address);
  if (!point) return null;

  const supabase = await createClient();
  await supabase
    .from("tenants")
    .update({ field_service_base_lat: point.lat, field_service_base_lng: point.lng })
    .eq("id", ctx.tenantId);

  return point;
}

/**
 * Garante lat/lng nas OS informadas, geocodificando so as que ainda nao tem.
 * Cada OS e geocodificada uma unica vez na vida (a coluna e limpa se o
 * endereco mudar, em updateServiceOrder).
 */
async function ensureGeocoded(ctx: Ctx, orders: any[]) {
  const supabase = await createClient();
  const resolved = new Map<string, LatLng>();

  for (const order of orders) {
    if (order.lat != null && order.lng != null) {
      resolved.set(order.id, { lat: order.lat, lng: order.lng });
      continue;
    }

    const query = buildAddressQuery(order);
    if (!query) continue;

    const point = await geocodeAddress(query);
    if (!point) continue;

    await supabase
      .from("service_orders")
      .update({ lat: point.lat, lng: point.lng, geocoded_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("tenant_id", ctx.tenantId);

    resolved.set(order.id, point);
  }

  return resolved;
}

export type OptimizeShiftResult = {
  optimized: number;
  skipped: number;
  distanceLabel: string;
  durationLabel: string;
};

/**
 * Reordena as paradas de um tecnico num turno, gravando route_position.
 * Disparado por botao (nao no carregamento da tela) porque a chamada e paga.
 */
export async function optimizeShiftRoute(input: {
  service_date: string;
  shift: "manha" | "tarde";
  technician_id: string;
}): Promise<OptimizeShiftResult> {
  const ctx = await requireRoutingContext();

  const base = await resolveBaseLocation(ctx);
  if (!base) {
    throw new Error(
      "Cadastre o endereco base da empresa em Configuracoes antes de otimizar a rota.",
    );
  }

  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("service_order_technicians")
    .select("service_order_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", input.technician_id);

  const orderIds = (assignments ?? []).map((row: any) => row.service_order_id as string);
  if (orderIds.length === 0) {
    return { optimized: 0, skipped: 0, distanceLabel: "0 m", durationLabel: "0 min" };
  }

  const { data: orders } = await supabase
    .from("service_orders")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", input.service_date)
    .eq("shift", input.shift)
    .in("id", orderIds)
    .order("route_position", { ascending: true, nullsFirst: false });

  const shiftOrders = (orders ?? []) as any[];
  if (shiftOrders.length === 0) {
    return { optimized: 0, skipped: 0, distanceLabel: "0 m", durationLabel: "0 min" };
  }

  const coords = await ensureGeocoded(ctx, shiftOrders);
  const routable = shiftOrders.filter((order) => coords.has(order.id));
  const skipped = shiftOrders.length - routable.length;

  if (routable.length === 0) {
    throw new Error("Nenhuma OS do turno tem endereco que o Google conseguiu localizar.");
  }

  const result = await optimizeRoute(
    base,
    routable.map((order) => coords.get(order.id)!),
  );

  for (const [position, sourceIndex] of result.order.entries()) {
    const order = routable[sourceIndex];
    if (!order) continue;
    await supabase
      .from("service_orders")
      .update({ route_position: position + 1, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("tenant_id", ctx.tenantId);
  }

  revalidatePath("/os/roteiro");

  return {
    optimized: routable.length,
    skipped,
    distanceLabel: formatDistance(result.distanceMeters),
    durationLabel: formatDuration(result.durationSeconds),
  };
}

export type TechnicianSuggestionResult = {
  technicianId: string;
  technicianName: string;
  extraLabel: string;
  stopCount: number;
};

/**
 * Dada uma OS nova entrando num turno, diz qual tecnico absorve com o menor
 * desvio de rota - a dor que eles descreveram nas inclusoes de ultima hora.
 */
export async function suggestTechnicianForOrder(input: {
  service_order_id: string;
  service_date: string;
  shift: "manha" | "tarde";
}): Promise<TechnicianSuggestionResult[]> {
  const ctx = await requireRoutingContext();

  const base = await resolveBaseLocation(ctx);
  if (!base) {
    throw new Error(
      "Cadastre o endereco base da empresa em Configuracoes antes de pedir sugestao de tecnico.",
    );
  }

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("service_orders")
    .select("*")
    .eq("id", input.service_order_id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!order) throw new Error("OS nao encontrada");

  const newCoords = await ensureGeocoded(ctx, [order]);
  const newStop = newCoords.get(order.id);
  if (!newStop) {
    throw new Error("Nao foi possivel localizar o endereco dessa OS no mapa.");
  }

  const { data: shiftOrders } = await supabase
    .from("service_orders")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", input.service_date)
    .eq("shift", input.shift)
    .neq("id", order.id);

  const others = (shiftOrders ?? []) as any[];
  const otherIds = others.map((o) => o.id);

  const { data: assignments } = otherIds.length
    ? await supabase
        .from("service_order_technicians")
        .select("service_order_id, user_id")
        .in("service_order_id", otherIds)
    : { data: [] };

  const coords = await ensureGeocoded(ctx, others);
  const technicians = await listTechnicians(ctx.tenantId);

  const stopsByTechnician = new Map<string, LatLng[]>();
  for (const tech of technicians) stopsByTechnician.set(tech.id, []);
  for (const row of (assignments ?? []) as Array<{ service_order_id: string; user_id: string }>) {
    const point = coords.get(row.service_order_id);
    if (!point) continue;
    const list = stopsByTechnician.get(row.user_id);
    if (list) list.push(point);
  }

  // Distancia atual de cada tecnico, pra medir o acrescimo em vez do total.
  const loads = await Promise.all(
    technicians.map(async (tech) => {
      const stops = stopsByTechnician.get(tech.id) ?? [];
      const current = stops.length > 0 ? await optimizeRoute(base, stops) : { distanceMeters: 0 };
      return {
        technicianId: tech.id,
        technicianName: tech.name,
        stops,
        currentDistanceMeters: current.distanceMeters,
      };
    }),
  );

  const suggestions = await suggestBestTechnician(base, loads, newStop);

  return suggestions.map((item) => ({
    technicianId: item.technicianId,
    technicianName: item.technicianName,
    extraLabel: formatDistance(item.extraDistanceMeters),
    stopCount: item.stopCount,
  }));
}
