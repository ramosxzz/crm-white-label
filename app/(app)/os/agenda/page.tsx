import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Handshake, List, Map as MapIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders, canViewServiceRoutes } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { listTechnicians, listConsultants } from "@/lib/field-service/users";
import { brtDay, humanDay, offsetDay } from "@/lib/field-service/agenda";
import type { FieldServicePartner } from "@/lib/supabase/database.types";
import { ServiceOrdersLive } from "../service-orders-live";
import { AgendaGrid, type AgendaOrder } from "./agenda-grid";
import { AgendaDayPicker } from "./agenda-day-picker";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  if (!canViewServiceRoutes(ctx.role)) redirect("/os");
  const canManage = canManageServiceOrders(ctx.role);

  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day ?? "") ? params!.day! : brtDay();

  const supabase = await createClient();

  const [{ data: dayOrders }, { data: pool }, technicians, consultants, { data: partnersData }, { data: leads }] =
    await Promise.all([
      supabase
        .from("service_orders")
        .select("*, leads(name, phone)")
        .eq("tenant_id", ctx.tenantId)
        .eq("service_date", day)
        .order("scheduled_start_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("service_orders")
        .select("*, leads(name, phone)")
        .eq("tenant_id", ctx.tenantId)
        .is("service_date", null)
        .in("status", ["rascunho", "remarcada"])
        .order("created_at", { ascending: true })
        .limit(50),
      listTechnicians(ctx.tenantId),
      canManage ? listConsultants(ctx.tenantId) : Promise.resolve([]),
      canManage
        ? supabase
            .from("field_service_partners")
            .select("*")
            .eq("tenant_id", ctx.tenantId)
            .eq("is_active", true)
            .order("kind")
            .order("name")
        : Promise.resolve({ data: [] as FieldServicePartner[] }),
      canManage
        ? supabase
            .from("leads")
            .select("id, name, phone")
            .eq("tenant_id", ctx.tenantId)
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] }),
    ]);

  const orders = [...(dayOrders ?? []), ...(pool ?? [])] as any[];
  const orderIds = orders.map((o) => o.id);

  const [{ data: assignments }, { data: items }] = await Promise.all([
    orderIds.length
      ? supabase
          .from("service_order_technicians")
          .select("service_order_id, user_id")
          .in("service_order_id", orderIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabase
          .from("service_order_items")
          .select("service_order_id, description, kind")
          .eq("kind", "original")
          .in("service_order_id", orderIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const techniciansByOrder = new Map<string, string[]>();
  for (const row of (assignments ?? []) as Array<{ service_order_id: string; user_id: string }>) {
    const list = techniciansByOrder.get(row.service_order_id) ?? [];
    list.push(row.user_id);
    techniciansByOrder.set(row.service_order_id, list);
  }

  const serviceLabelByOrder = new Map<string, string>();
  for (const row of (items ?? []) as Array<{ service_order_id: string; description: string }>) {
    if (!serviceLabelByOrder.has(row.service_order_id)) {
      serviceLabelByOrder.set(row.service_order_id, row.description);
    }
  }

  const agendaOrders: AgendaOrder[] = orders.map((order) => ({
    id: order.id,
    codeSeq: order.code_seq,
    status: order.status,
    leadName: order.leads?.name ?? "Lead removido",
    leadPhone: order.leads?.phone ?? null,
    addressStreet: order.address_street,
    addressNumber: order.address_number,
    addressDistrict: order.address_district,
    addressCity: order.address_city,
    serviceLabel: serviceLabelByOrder.get(order.id) ?? null,
    totalCents: order.total_cents ?? 0,
    shift: order.shift,
    serviceDate: order.service_date,
    scheduledStartAt: order.scheduled_start_at,
    scheduledEndAt: order.scheduled_end_at,
    confirmedAt: order.confirmed_at,
    hasPendingIssue: Boolean(order.has_pending_issue),
    technicianIds: techniciansByOrder.get(order.id) ?? [],
  }));

  return (
    <div>
      <ServiceOrdersLive tenantId={ctx.tenantId} />
      <PageHeader
        eyebrow="Serviço em campo"
        title="Agenda"
        description={humanDay(day)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/os/agenda?day=${offsetDay(day, -1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/os/agenda"
              className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Hoje
            </Link>
            <Link
              href={`/os/agenda?day=${offsetDay(day, 1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            <AgendaDayPicker day={day} />
            <Link
              href="/os"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <List className="h-4 w-4" /> Lista de OS
            </Link>
            <Link
              href="/os/roteiro"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <CalendarDays className="h-4 w-4" /> Roteiro
            </Link>
            <Link
              href="/os/mapa"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <MapIcon className="h-4 w-4" /> Mapa
            </Link>
            {canManage && (
              <Link
                href="/os/parceiros"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                <Handshake className="h-4 w-4" /> Parceiros
              </Link>
            )}
          </div>
        }
      />

      <AgendaGrid
        day={day}
        technicians={technicians}
        orders={agendaOrders}
        canManage={canManage}
        leads={(leads ?? []) as Array<{ id: string; name: string; phone: string | null }>}
        consultants={consultants}
        partners={(partnersData ?? []) as FieldServicePartner[]}
      />
    </div>
  );
}
