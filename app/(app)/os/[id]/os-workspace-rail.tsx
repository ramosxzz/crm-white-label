import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatServiceOrderCode, SERVICE_ORDER_STATUS_LABEL } from "@/lib/field-service/status";
import { offsetDay } from "@/lib/field-service/agenda";

function formatTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

const STATUS_DOT: Record<string, string> = {
  agendada: "bg-sky-500",
  em_execucao: "bg-amber-500",
  concluida: "bg-emerald-500",
  conferida: "bg-emerald-600",
  faturada: "bg-slate-400",
  remarcada: "bg-orange-500",
  cancelada: "bg-red-400",
  rascunho: "bg-slate-300",
  assistencia: "bg-violet-500",
};

/**
 * Substitui o menu principal do CRM enquanto uma OS ta aberta (o layout
 * recolhe a Sidebar pra essa rota - ver app/(app)/layout.tsx): mostra o dia
 * inteiro, todos os tecnicos, pra trocar de OS sem sair da tela e sem
 * precisar ir e voltar da Agenda. Pedido explicito: "tela de agenda inteira,
 * mas outra tela com TUDO numa unica tela".
 */
export async function OsWorkspaceRail({
  tenantId,
  currentOrderId,
  day,
}: {
  tenantId: string;
  currentOrderId: string;
  day: string;
}) {
  const supabase = createServiceClient();

  const { data: orders } = await supabase
    .from("service_orders")
    .select("id, code_seq, status, shift, scheduled_start_at, address_city, leads(name)")
    .eq("tenant_id", tenantId)
    .eq("service_date", day)
    .not("status", "in", "(cancelada)")
    .order("route_position", { ascending: true, nullsFirst: false });

  const rows = (orders ?? []) as any[];

  const orderIds = rows.map((o) => o.id);
  const { data: assignments } = orderIds.length
    ? await supabase.from("service_order_technicians").select("service_order_id, user_id").in("service_order_id", orderIds)
    : { data: [] };
  const techIds = [...new Set((assignments ?? []).map((a: any) => a.user_id))];
  const { data: profiles } = techIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", techIds)
    : { data: [] };
  const nameById = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p.full_name]));

  const techByOrder = new Map<string, string>();
  for (const a of (assignments ?? []) as any[]) {
    if (!techByOrder.has(a.service_order_id)) {
      techByOrder.set(a.service_order_id, nameById.get(a.user_id) ?? "Sem técnico");
    }
  }

  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const tech = techByOrder.get(row.id) ?? "Sem técnico";
    const list = groups.get(tech) ?? [];
    list.push(row);
    groups.set(tech, list);
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col self-start border-r border-border bg-card xl:flex">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agenda do dia</p>
          <p className="text-sm font-semibold">
            {new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </p>
        </div>
        <Link
          href="/os/agenda"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60"
          title="Sair da OS, voltar pro menu"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] gap-1 border-b border-border/70 p-2">
        <Link
          href={`/os/agenda?day=${offsetDay(day, -1)}`}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border/70 hover:bg-muted/50"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link
          href={`/os/agenda?day=${day}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-brand px-2 text-xs font-semibold text-brand-foreground"
        >
          <CalendarDays className="h-3.5 w-3.5" /> Agenda completa
        </Link>
        <Link
          href={`/os/agenda?day=${offsetDay(day, 1)}`}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border/70 hover:bg-muted/50"
          aria-label="Próximo dia"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {groups.size === 0 && (
          <p className="px-2 text-xs text-muted-foreground">Nenhuma OS agendada pra esse dia.</p>
        )}
        {[...groups.entries()].map(([tech, list]) => (
          <div key={tech}>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tech}
            </p>
            <div className="space-y-1">
              {list.map((row) => (
                <Link
                  key={row.id}
                  href={`/os/${row.id}`}
                  className={cn(
                    "block rounded-lg border px-2.5 py-2 text-xs transition-colors",
                    row.id === currentOrderId
                      ? "border-brand bg-brand/10"
                      : "border-border/60 bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[row.status] ?? "bg-slate-300")} />
                    {formatServiceOrderCode(row.code_seq)}
                    {row.scheduled_start_at && (
                      <span className="ml-auto font-normal text-muted-foreground">{formatTime(row.scheduled_start_at)}</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-muted-foreground">{row.leads?.name ?? "Lead removido"}</p>
                  <p className="mt-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <span className="truncate">{row.address_city ?? "Cidade não informada"}</span>
                    <span className="shrink-0">
                      {SERVICE_ORDER_STATUS_LABEL[row.status as keyof typeof SERVICE_ORDER_STATUS_LABEL] ?? row.status}
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
