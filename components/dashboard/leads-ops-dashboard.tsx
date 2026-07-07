import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  MessageCircle,
  Sparkles,
  Target,
  UserPlus,
  Users,
  CalendarDays,
  ClipboardList,
  Boxes,
  Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRTTime } from "@/lib/date/brt";
import type { LeadsDashboardData } from "@/lib/leads/dashboard-metrics";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { LeadsByStageChart, LeadsPerDayChart, LeadsTodayHourChart } from "@/app/(app)/dashboard/charts";

export function LeadsOpsDashboard({ data, stockEnabled = true }: { data: LeadsDashboardData; stockEnabled?: boolean }) {
  const leadTrend =
    data.kpis.newLeadsYesterday === 0
      ? data.kpis.newLeadsToday > 0
        ? 100
        : 0
      : Math.round(
          ((data.kpis.newLeadsToday - data.kpis.newLeadsYesterday) / data.kpis.newLeadsYesterday) * 100,
        );

  const totalPipeline = data.pipelineByStage.reduce((a, s) => a + s.count, 0);

  return (
    <div className="space-y-6 p-6 md:p-8">
      <section className="border-b border-brand/25 bg-card px-1 pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Operações do dia
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold capitalize md:text-3xl">{data.dateLabel}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Resumo em tempo real dos leads, conversas e desempenho do funil — horário de Brasília.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="brand">
              <Link href="/leads">Ver todos os leads</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/kanban">Abrir kanban</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OpsCard icon={<Inbox className="h-4 w-4" />} label="Fila compartilhada" value={data.operations.sharedQueueLeads} href="/leads" />
        <OpsCard icon={<CalendarDays className="h-4 w-4" />} label="Horarios hoje" value={data.operations.appointmentsToday} href="/agenda" />
        <OpsCard icon={<ClipboardList className="h-4 w-4" />} label="Tarefas atrasadas" value={data.operations.overdueTasks} href="/leads" alert={data.operations.overdueTasks > 0} />
        {stockEnabled && (
          <OpsCard icon={<Boxes className="h-4 w-4" />} label="Estoque baixo" value={data.operations.lowStockProducts} hint={`${data.operations.activeReservations} reserva(s) ativa(s)`} href="/estoque" alert={data.operations.lowStockProducts > 0} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<UserPlus className="h-4 w-4" />}
          label="Novos leads hoje"
          value={String(data.kpis.newLeadsToday)}
          trend={leadTrend}
          hint="vs. ontem"
        />
        <KpiCard
          icon={<MessageCircle className="h-4 w-4" />}
          label="Mensagens enviadas"
          value={String(data.kpis.outboundMessagesToday)}
          hint="saídas no WhatsApp hoje"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Conversas ativas"
          value={String(data.kpis.activeConversationsToday)}
          hint="com atividade hoje"
        />
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Ganhos hoje"
          value={String(data.kpis.wonToday)}
          hint={formatCurrencyBRL(data.kpis.pipelineValueTodayCents) + " em novos leads"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Entrada de leads por hora</CardTitle>
            <CardDescription>Distribuição de novos cadastros ao longo do dia</CardDescription>
          </CardHeader>
          <CardContent>
            {data.leadsByHour.every((h) => h.count === 0) ? (
              <EmptyChart message="Nenhum lead novo hoje ainda." />
            ) : (
              <LeadsTodayHourChart data={data.leadsByHour} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Origens de hoje</CardTitle>
            <CardDescription>De onde vieram os leads cadastrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sourcesToday.length === 0 ? (
              <EmptyChart message="Sem origens registradas hoje." compact />
            ) : (
              data.sourcesToday.map((s, i) => {
                const pct = data.kpis.newLeadsToday
                  ? Math.round((s.count / data.kpis.newLeadsToday) * 100)
                  : 0;
                return (
                  <div key={s.source} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.source}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {s.count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${Math.max(pct, 4)}%`, opacity: 1 - i * 0.12 }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Funil atual</CardTitle>
            <CardDescription>
              {totalPipeline} leads distribuídos · snapshot do pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalPipeline === 0 ? (
              <EmptyChart message="Pipeline vazio — cadastre o primeiro lead." />
            ) : (
              <LeadsByStageChart
                data={data.pipelineByStage.map((s) => ({
                  name: s.name,
                  color: s.color,
                  count: s.count,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Últimos 7 dias</CardTitle>
            <CardDescription>Tendência de novos leads na semana</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsPerDayChart data={data.weekTrend} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Leads de hoje</CardTitle>
            <CardDescription>Cadastros do dia com estágio e origem</CardDescription>
          </div>
          <Badge variant="brand" className="font-semibold">
            {data.recentToday.length} registro(s)
          </Badge>
        </CardHeader>
        <CardContent>
          {data.recentToday.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
              Nenhum lead entrou hoje. Quando chegar, aparece aqui em tempo real.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Lead</th>
                    <th className="px-4 py-2.5 font-medium">Horário</th>
                    <th className="px-4 py-2.5 font-medium">Estágio</th>
                    <th className="px-4 py-2.5 font-medium">Origem</th>
                    <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.recentToday.map((l) => (
                    <tr key={l.id} className="transition-colors hover:bg-brand/8 dark:hover:bg-brand/12">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="font-semibold hover:text-brand">
                          {l.name}
                        </Link>
                        {l.phone && (
                          <p className="text-xs text-muted-foreground">{l.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatBRTTime(l.created_at)}</td>
                      <td className="px-4 py-3">
                        {l.stageName ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: l.stageColor ?? undefined,
                              color: l.stageColor ?? undefined,
                            }}
                          >
                            {l.stageName}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{l.source ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrencyBRL(l.value_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpsCard({ icon, label, value, hint, href, alert }: { icon: React.ReactNode; label: string; value: number; hint?: string; href: string; alert?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 border border-border/70 bg-card px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5">
      <span className={cn("grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground", alert && "bg-destructive/10 text-destructive")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      <strong className={cn("font-mono text-xl", alert && "text-destructive")}>{value}</strong>
    </Link>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number;
  hint?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/20">
            {icon}
          </div>
          {trend !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                trend >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground",
        compact ? "py-8" : "py-16",
      )}
    >
      {message}
    </div>
  );
}
