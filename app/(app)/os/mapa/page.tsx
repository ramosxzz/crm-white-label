import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { listTechnicians } from "@/lib/field-service/users";
import { formatServiceOrderCode } from "@/lib/field-service/status";
import { resolveBaseLocation } from "@/lib/field-service/base-location";
import { TechniciansMap } from "./technicians-map";
import type { MapBase, MapStop } from "./types";

function brtDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function offsetDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00-03:00`);
  date.setDate(date.getDate() + amount);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function humanDay(day: string) {
  return new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatAddress(order: {
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_city: string | null;
}) {
  return (
    [
      [order.address_street, order.address_number].filter(Boolean).join(", "),
      order.address_district,
      order.address_city,
    ]
      .filter(Boolean)
      .join(" · ") || "Endereço não informado"
  );
}

export default async function ServiceOrderMapPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  if (!canManageServiceOrders(ctx.role)) redirect("/os");

  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day ?? "") ? params!.day! : brtDay();

  const supabase = await createClient();

  const [{ data: dayOrders }, technicians] = await Promise.all([
    supabase
      .from("service_orders")
      .select("*, leads(name)")
      .eq("tenant_id", ctx.tenantId)
      .eq("service_date", day)
      .order("route_position", { ascending: true, nullsFirst: false }),
    listTechnicians(ctx.tenantId),
  ]);

  const orders = (dayOrders ?? []) as any[];
  const orderIds = orders.map((order) => order.id);

  const { data: assignments } = orderIds.length
    ? await supabase
        .from("service_order_technicians")
        .select("service_order_id, user_id, is_primary")
        .in("service_order_id", orderIds)
        .order("is_primary", { ascending: false })
    : { data: [] };

  const techniciansByOrder = new Map<string, string[]>();
  for (const row of (assignments ?? []) as Array<{ service_order_id: string; user_id: string }>) {
    const list = techniciansByOrder.get(row.service_order_id) ?? [];
    list.push(row.user_id);
    techniciansByOrder.set(row.service_order_id, list);
  }

  // So entra no mapa OS ja geocodificada. O geocoding acontece no roteiro
  // (botao de otimizar/sugerir), entao endereco novo pode ainda nao ter ponto.
  const plotted = orders.filter((order) => order.lat != null && order.lng != null);

  const stops: MapStop[] = plotted.map((order) => ({
    id: order.id,
    code: formatServiceOrderCode(order.code_seq),
    lat: order.lat,
    lng: order.lng,
    leadName: order.leads?.name ?? "Lead removido",
    address: formatAddress(order),
    status: order.status,
    shift: order.shift,
    routePosition: order.route_position,
    totalCents: order.total_cents ?? 0,
    technicianIds: techniciansByOrder.get(order.id) ?? [],
  }));

  // Descobre a coordenada da sede na primeira vez e grava no tenant, pra a
  // casinha aparecer sem depender de alguem ter clicado em "Otimizar rota".
  const basePoint = await resolveBaseLocation(ctx.tenant, ctx.tenantId);
  const base: MapBase | null = basePoint
    ? {
        lat: basePoint.lat,
        lng: basePoint.lng,
        address: ctx.tenant.field_service_base_address ?? "Base da empresa",
      }
    : null;

  const missing = orders.length - plotted.length;

  return (
    <div>
      <PageHeader
        eyebrow="Serviço em campo"
        title="Mapa do dia"
        description={humanDay(day)}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/os/mapa?day=${offsetDay(day, -1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/os/mapa"
              className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Hoje
            </Link>
            <Link
              href={`/os/mapa?day=${offsetDay(day, 1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/os/roteiro?day=${day}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <CalendarDays className="h-4 w-4" /> Roteiro
            </Link>
          </div>
        }
      />

      <div className="space-y-4 p-8">
        {technicians.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
            <p className="font-medium">Nenhum técnico cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre usuários com o papel &quot;Técnico&quot; em Configurações → Usuários pra
              ver as rotas no mapa.
            </p>
          </div>
        ) : (
          <TechniciansMap stops={stops} technicians={technicians} base={base} />
        )}

        {missing > 0 && (
          <p className="text-xs text-muted-foreground">
            {missing} {missing === 1 ? "OS do dia não aparece" : "OS do dia não aparecem"} no mapa
            por não {missing === 1 ? "ter" : "terem"} endereço localizado. Abrir o roteiro e usar
            &quot;Otimizar rota&quot; resolve a localização.
          </p>
        )}
      </div>
    </div>
  );
}
