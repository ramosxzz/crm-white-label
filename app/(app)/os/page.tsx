import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, Map as MapIcon, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  canAccessServiceOrders,
  canManageServiceOrders,
  canViewServiceRoutes,
} from "@/lib/auth/roles";
import { formatCurrencyBRL } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  formatServiceOrderCode,
} from "@/lib/field-service/status";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { listConsultants } from "@/lib/field-service/users";
import { ServiceOrderStatusBadge } from "./status-badge";
import { NewServiceOrderDialog } from "./new-service-order-dialog";
import { ServiceOrdersLive } from "./service-orders-live";

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "abertas", label: "Em aberto" },
  { value: "rascunho", label: "Rascunho" },
  { value: "agendada", label: "Agendadas" },
  { value: "em_execucao", label: "Em execução" },
  { value: "concluida", label: "Concluídas" },
  { value: "conferida", label: "Conferidas" },
  { value: "faturada", label: "Faturadas" },
  { value: "todas", label: "Todas" },
];

// "Em aberto" e o filtro padrao: tudo que ainda exige acao de alguem.
const OPEN_STATUSES: ServiceOrderStatus[] = ["rascunho", "agendada", "em_execucao", "concluida", "remarcada"];

function formatAddress(order: {
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_city: string | null;
}) {
  const line = [
    [order.address_street, order.address_number].filter(Boolean).join(", "),
    order.address_district,
    order.address_city,
  ]
    .filter(Boolean)
    .join(" · ");
  return line || "Endereço não informado";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default async function ServiceOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  if (!canAccessServiceOrders(ctx.role)) redirect("/dashboard");

  const { status = "abertas" } = await searchParams;
  const supabase = await createClient();

  // A RLS ja restringe o que cada papel enxerga: gestao ve tudo, vendedor so
  // as OS que ele vendeu, tecnico so as dele.
  let query = supabase
    .from("service_orders")
    .select("*, leads(name, phone)")
    .eq("tenant_id", ctx.tenantId);

  if (status === "abertas") {
    query = query.in("status", OPEN_STATUSES);
  } else if (status !== "todas") {
    query = query.eq("status", status);
  }

  const { data: orders } = await query
    .order("service_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const canManage = canManageServiceOrders(ctx.role);
  const consultants = canManage ? await listConsultants(ctx.tenantId) : [];

  const { data: leads } = canManage
    ? await supabase
        .from("leads")
        .select("id, name, phone")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [] };

  const rows = orders ?? [];

  return (
    <div>
      <ServiceOrdersLive tenantId={ctx.tenantId} />
      <PageHeader
        eyebrow="Serviço em campo"
        title="Ordens de serviço"
        description={`${rows.length} ${rows.length === 1 ? "OS" : "OS"} nesse filtro`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/os/roteiro"
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <CalendarDays className="h-4 w-4" /> Roteiro
            </Link>
            {canViewServiceRoutes(ctx.role) && (
              <Link
                href="/os/mapa"
                className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                <MapIcon className="h-4 w-4" /> Mapa
              </Link>
            )}
            {canManage && (
              <NewServiceOrderDialog
                leads={(leads ?? []) as Array<{ id: string; name: string; phone: string | null }>}
                consultants={consultants}
              />
            )}
          </div>
        }
      />

      <div className="space-y-6 p-8">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = filter.value === status;
            return (
              <Link
                key={filter.value}
                href={`/os?status=${filter.value}`}
                className={
                  active
                    ? "rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                    : "rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/70 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">OS</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Endereço</th>
                  <th className="px-5 py-3 font-medium">Agenda</th>
                  <th className="px-5 py-3 font-medium">Valor</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <p className="font-medium">Nenhuma ordem de serviço aqui</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {canManage
                          ? "Crie uma OS a partir de um lead pra começar."
                          : "Assim que uma OS for atribuída a você, ela aparece nessa lista."}
                      </p>
                    </td>
                  </tr>
                )}
                {rows.map((order: any) => {
                  const scheduled = formatDate(order.service_date);
                  return (
                    <tr key={order.id} className="group transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3 font-medium">
                        <Link href={`/os/${order.id}`} className="transition-colors hover:text-brand">
                          {formatServiceOrderCode(order.code_seq)}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{order.leads?.name ?? "Lead removido"}</p>
                        {order.leads?.phone && (
                          <p className="text-xs text-muted-foreground">{order.leads.phone}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-start gap-1">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          {formatAddress(order)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {scheduled ? (
                          <span className="inline-flex flex-col">
                            <span className="font-medium">{scheduled}</span>
                            {order.shift && (
                              <span className="text-muted-foreground">
                                {SERVICE_ORDER_SHIFT_LABEL[order.shift as "manha" | "tarde"]}
                              </span>
                            )}
                          </span>
                        ) : (
                          <Badge variant="outline">Sem agenda</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 font-medium">{formatCurrencyBRL(order.total_cents)}</td>
                      <td className="px-5 py-3">
                        <ServiceOrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/os/${order.id}`}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
