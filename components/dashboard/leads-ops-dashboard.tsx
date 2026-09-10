import Link from "next/link";
import { CalendarDays, ClipboardList, Boxes, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBRTTime } from "@/lib/date/brt";
import type { LeadsDashboardData } from "@/lib/leads/dashboard-metrics";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { LeadsTodayHourChart } from "@/app/(app)/dashboard/charts";
import type { MetaAdsDashboardData } from "@/lib/meta/ads-insights";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { AttentionRequired } from "@/components/dashboard/attention-required";
import { PipelineOverview } from "@/components/dashboard/pipeline-overview";
import { CommercialActivity } from "@/components/dashboard/commercial-activity";
import { MarketingSummary } from "@/components/dashboard/marketing-summary";

export function LeadsOpsDashboard({
  data,
  stockEnabled = true,
  metaAds,
  stages,
  todayStr,
  selectedDate,
}: {
  data: LeadsDashboardData;
  stockEnabled?: boolean;
  metaAds?: MetaAdsDashboardData;
  stages: { id: string; name: string }[];
  todayStr: string;
  selectedDate: string;
}) {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <DashboardHeader
        userFirstName={data.userFirstName}
        dayLabel={data.dateLabel}
        selectedDate={selectedDate}
        todayStr={todayStr}
        sharedQueueLeads={data.operations.sharedQueueLeads}
        appointmentsToday={data.operations.appointmentsToday}
        overdueTasks={data.operations.overdueTasks}
        stages={stages}
      />

      <DashboardKpis
        newLeadsInPeriod={data.kpis.newLeadsInPeriod}
        newLeadsPreviousPeriod={data.kpis.newLeadsPreviousPeriod}
        inProgress={data.kpis.inProgress}
        openOpportunities={data.kpis.openOpportunities}
        wonInPeriod={data.kpis.wonInPeriod}
        wonValueInPeriodCents={data.kpis.wonValueInPeriodCents}
        period={data.period}
      />

      <AttentionRequired items={data.attention} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OpsCard icon={<Inbox className="h-4 w-4" />} label="Fila compartilhada" value={data.operations.sharedQueueLeads} href="/leads" />
        <OpsCard icon={<CalendarDays className="h-4 w-4" />} label="Horários hoje" value={data.operations.appointmentsToday} href="/agenda" />
        {stockEnabled ? (
          <OpsCard icon={<Boxes className="h-4 w-4" />} label="Estoque baixo" value={data.operations.lowStockProducts} hint={`${data.operations.activeReservations} reserva(s) ativa(s)`} href="/estoque" alert={data.operations.lowStockProducts > 0} />
        ) : (
          <OpsCard icon={<ClipboardList className="h-4 w-4" />} label="Tarefas atrasadas" value={data.operations.overdueTasks} href="/tarefas" alert={data.operations.overdueTasks > 0} />
        )}
      </div>

      <PipelineOverview stages={data.pipelineByStage} period={data.period} periodParams={data.periodParams} />

      <CommercialActivity leadsTrend={data.leadsWeekTrend} wonTrend={data.wonWeekTrend} />

      {metaAds && <MarketingSummary data={metaAds} />}

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Entrada de leads por hora</CardTitle>
            <CardDescription>Distribuição de novos cadastros ao longo do dia</CardDescription>
          </CardHeader>
          <CardContent>
            {data.leadsByHour.every((h) => h.count === 0) ? (
              <EmptyState compact message="Nenhum lead novo neste dia." />
            ) : (
              <LeadsTodayHourChart data={data.leadsByHour} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Origens do dia</CardTitle>
            <CardDescription>De onde vieram os leads cadastrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sourcesToday.length === 0 ? (
              <EmptyState compact message="Sem origens registradas neste dia." />
            ) : (
              (() => {
                const sourcesTotal = data.sourcesToday.reduce((a, x) => a + x.count, 0);
                return data.sourcesToday.map((s, i) => {
                  const pct = sourcesTotal > 0 ? Math.round((s.count / sourcesTotal) * 100) : 0;
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
                });
              })()
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Leads do dia</CardTitle>
            <CardDescription>Cadastros do dia com estágio e origem</CardDescription>
          </div>
          <Badge variant="brand" className="font-semibold">
            {data.recentToday.length} registro(s)
          </Badge>
        </CardHeader>
        <CardContent>
          {data.recentToday.length === 0 ? (
            <EmptyState message="Nenhum lead entrou neste dia. Quando chegar, aparece aqui em tempo real." />
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
