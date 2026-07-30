import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Map as MapIcon, MapPin, Sun, Sunset } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders, canViewServiceRoutes } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { formatServiceOrderCode } from "@/lib/field-service/status";
import { listTechnicians } from "@/lib/field-service/users";
import { isRoutingEnabled } from "@/lib/field-service/routing";
import { ServiceOrderStatusBadge } from "../status-badge";
import { RouteOptimizer } from "./route-optimizer";
import { TechnicianSuggester } from "./technician-suggester";
import { ServiceOrdersLive } from "../service-orders-live";

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

const SHIFTS = [
  { value: "manha" as const, label: "Manhã", Icon: Sun },
  { value: "tarde" as const, label: "Tarde", Icon: Sunset },
];

function shortAddress(order: any) {
  return (
    [order.address_street, order.address_number].filter(Boolean).join(", ") ||
    order.address_district ||
    "Sem endereço"
  );
}

function OrderCard({ order }: { order: any }) {
  return (
    <Link
      href={`/os/${order.id}`}
      className="block rounded-lg border border-border/70 bg-background/40 p-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{order.leads?.name ?? "Lead removido"}</p>
          <p className="text-[11px] text-muted-foreground">{formatServiceOrderCode(order.code_seq)}</p>
        </div>
        {order.route_position != null && (
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
            {order.route_position}ª
          </span>
        )}
      </div>
      <p className="mt-2 inline-flex items-start gap-1 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
        <span className="line-clamp-2">{shortAddress(order)}</span>
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <ServiceOrderStatusBadge status={order.status} />
        <span className="text-xs font-medium">{formatCurrencyBRL(order.total_cents)}</span>
      </div>
    </Link>
  );
}

export default async function RoteiroPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  if (!canViewServiceRoutes(ctx.role)) redirect("/os");
  // Vendedora ve o trajeto, mas nao mexe: otimizar rota, alocar tecnico e
  // reagendar continuam so pra gestao.
  const canManage = canManageServiceOrders(ctx.role);

  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day ?? "") ? params!.day! : brtDay();

  const supabase = await createClient();

  const [{ data: dayOrders }, { data: pool }, technicians] = await Promise.all([
    supabase
      .from("service_orders")
      .select("*, leads(name, phone)")
      .eq("tenant_id", ctx.tenantId)
      .eq("service_date", day)
      .order("route_position", { ascending: true, nullsFirst: false }),
    // Fila: OS pronta pra entrar num turno (inclusoes e remarcacoes do dia).
    supabase
      .from("service_orders")
      .select("*, leads(name, phone)")
      .eq("tenant_id", ctx.tenantId)
      .is("service_date", null)
      .in("status", ["rascunho", "remarcada"])
      .order("created_at", { ascending: true })
      .limit(50),
    listTechnicians(ctx.tenantId),
  ]);

  const orders = (dayOrders ?? []) as any[];
  const orderIds = orders.map((o) => o.id);

  // Uma OS pode ter mais de um tecnico (dupla na mesma residencia), entao a
  // alocacao vem de uma tabela separada em vez de uma coluna na OS.
  const { data: assignments } = orderIds.length
    ? await supabase
        .from("service_order_technicians")
        .select("service_order_id, user_id")
        .in("service_order_id", orderIds)
    : { data: [] };

  const techniciansByOrder = new Map<string, string[]>();
  for (const row of (assignments ?? []) as Array<{ service_order_id: string; user_id: string }>) {
    const list = techniciansByOrder.get(row.service_order_id) ?? [];
    list.push(row.user_id);
    techniciansByOrder.set(row.service_order_id, list);
  }

  function ordersFor(technicianId: string, shift: "manha" | "tarde") {
    return orders.filter(
      (order) =>
        order.shift === shift && (techniciansByOrder.get(order.id) ?? []).includes(technicianId),
    );
  }

  const unassigned = orders.filter((order) => (techniciansByOrder.get(order.id) ?? []).length === 0);

  // Roteirizacao so aparece com chave do Google configurada no servidor e
  // endereco base cadastrado - sem os dois ela nao teria de onde partir.
  const routingReady =
    canManage && isRoutingEnabled() && Boolean(ctx.tenant.field_service_base_address);

  return (
    <div>
      <ServiceOrdersLive tenantId={ctx.tenantId} />
      <PageHeader
        eyebrow="Serviço em campo"
        title="Roteiro do dia"
        description={humanDay(day)}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/os/roteiro?day=${offsetDay(day, -1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/os/roteiro"
              className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Hoje
            </Link>
            <Link
              href={`/os/roteiro?day=${offsetDay(day, 1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Próximo dia"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/os/mapa?day=${day}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <MapIcon className="h-4 w-4" /> Mapa
            </Link>
            <Link
              href="/os"
              className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Lista de OS
            </Link>
          </div>
        }
      />

      <div className="space-y-8 p-8">
        {technicians.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
            <p className="font-medium">Nenhum técnico cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre usuários com o papel &quot;Técnico&quot; em Configurações → Usuários pra montar o roteiro.
            </p>
          </div>
        )}

        {SHIFTS.map(({ value, label, Icon }) => (
          <section key={value} className="space-y-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
              <Icon className="h-4 w-4 text-brand" /> {label}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {technicians.map((tech) => {
                const list = ordersFor(tech.id, value);
                const total = list.reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
                return (
                  <div key={tech.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
                    <header className="mb-3 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{tech.name}</p>
                      <Badge variant={list.length > 4 ? "warning" : "outline"}>
                        {list.length} OS
                      </Badge>
                    </header>
                    <div className="space-y-2">
                      {list.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">Turno livre</p>
                      ) : (
                        list.map((order) => <OrderCard key={order.id} order={order} />)
                      )}
                    </div>
                    {total > 0 && (
                      <p className="mt-3 text-right text-xs text-muted-foreground">
                        {formatCurrencyBRL(total)} no turno
                      </p>
                    )}
                    {list.length > 0 &&
                      (routingReady ? (
                        <RouteOptimizer
                          serviceDate={day}
                          shift={value}
                          technicianId={tech.id}
                          disabled={list.length < 2}
                          reason={
                            list.length < 2
                              ? "Com uma parada só não há ordem pra otimizar."
                              : undefined
                          }
                        />
                      ) : (
                        <p className="mt-3 text-center text-[11px] leading-snug text-muted-foreground">
                          Cadastre o endereço base da empresa em Configurações pra liberar a
                          otimização de rota.
                        </p>
                      ))}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {unassigned.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-warning">Agendadas sem técnico</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {unassigned.map((order) => (
                <div key={order.id} className="space-y-2">
                  <OrderCard order={order} />
                  {routingReady && order.shift && (
                    <TechnicianSuggester
                      serviceOrderId={order.id}
                      serviceDate={day}
                      shift={order.shift}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Fila de inclusões <span className="text-muted-foreground">({(pool ?? []).length})</span>
          </h2>
          {(pool ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma OS aguardando agendamento.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(pool ?? []).map((order: any) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
