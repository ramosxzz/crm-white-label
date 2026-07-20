import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  MessageCircle,
  Target,
  UserPlus,
  Users,
  CalendarDays,
  ClipboardList,
  Boxes,
  Inbox,
  Megaphone,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ShoppingCart,
  BadgeCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRTTime } from "@/lib/date/brt";
import type { LeadsDashboardData } from "@/lib/leads/dashboard-metrics";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import { LeadsByStageChart, LeadsPerDayChart, LeadsTodayHourChart } from "@/app/(app)/dashboard/charts";
import type { MetaAdsDashboardData } from "@/lib/meta/ads-insights";
import { MetaAdsDateFilter } from "@/components/dashboard/meta-ads-date-filter";

export function LeadsOpsDashboard({
  data,
  stockEnabled = true,
  metaAds,
}: {
  data: LeadsDashboardData;
  stockEnabled?: boolean;
  metaAds?: MetaAdsDashboardData;
}) {
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
      <section className="border-b border-border/70 pb-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Painel operacional
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold capitalize tracking-normal md:text-2xl">
              {data.dateLabel}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Resumo diário de leads, conversas e desempenho comercial no horário de Brasília.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" className="bg-background/60">
              <Link href="/leads">Ver todos os leads</Link>
            </Button>
            <Button asChild variant="brand">
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

      {metaAds && <MetaAdsPanel data={metaAds} />}

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

function MetaAdsPanel({ data }: { data: MetaAdsDashboardData }) {
  const configured = data.status !== "not_configured";
  const hasRows = data.rows.length > 0;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-border/50">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-brand" />
            Meta Ads
          </CardTitle>
          <CardDescription>
            ROAS, CAC, gasto e desempenho de campanhas conectadas ao workspace.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaAdsDateFilter current={data.datePreset} />
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations/facebook">Configurar Meta</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {!configured && (
          <MetaNotice
            title="Conecte a conta de anúncios"
            message="Informe o ID da conta de anúncios e um token com permissão ads_read para habilitar o dashboard de mídia paga."
          />
        )}

        {data.status === "error" && (
          <MetaNotice
            tone="danger"
            title="Meta Ads não respondeu"
            message={data.error ?? "Revise o token, a conta de anúncios e as permissões da Marketing API."}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MiniMetric icon={<DollarSign className="h-4 w-4" />} label="Gasto" value={formatCurrencyBRL(data.totals.spendCents)} />
          <MiniMetric icon={<ShoppingCart className="h-4 w-4" />} label="Conversões (Meta)" value={`${data.totals.purchases}`} hint={`${formatCurrencyBRL(data.totals.revenueCents)} em vendas`} />
          <MiniMetric icon={<TrendingUp className="h-4 w-4" />} label="ROAS" value={`${data.totals.roas.toFixed(2)}x`} hint={formatCurrencyBRL(data.totals.revenueCents)} />
          <MiniMetric icon={<Users className="h-4 w-4" />} label="CPL" value={formatCurrencyBRL(data.totals.cplCents)} hint={`${data.totals.leads} lead(s) · custo por lead`} />
          <MiniMetric icon={<Target className="h-4 w-4" />} label="CAC" value={formatCurrencyBRL(data.totals.cacCents)} hint={`${data.totals.purchases} venda(s) · custo por cliente`} />
          <MiniMetric icon={<MousePointerClick className="h-4 w-4" />} label="Cliques / Leads" value={`${data.totals.clicks} / ${data.totals.leads}`} hint={`${data.totals.impressions} impressoes`} />
          <MiniMetric
            icon={<BadgeCheck className="h-4 w-4" />}
            label="Vendas no CRM"
            value={`${data.totals.crmSales ?? 0}`}
            hint={`${formatCurrencyBRL(data.totals.crmRevenueCents ?? 0)} · negócios ganhos com anúncio vinculado`}
          />
        </div>

        {configured && !hasRows ? (
          <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
            Nenhum anúncio com gasto encontrado no período.
          </div>
        ) : (
          hasRows && (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Anúncio</th>
                    <th className="px-4 py-2.5 font-medium">Campanha</th>
                    <th className="px-4 py-2.5 font-medium text-right">Gasto</th>
                    <th className="px-4 py-2.5 font-medium text-right">Leads</th>
                    <th className="px-4 py-2.5 font-medium text-right">Vendas (Meta)</th>
                    <th className="px-4 py-2.5 font-medium text-right">Vendas (CRM)</th>
                    <th className="px-4 py-2.5 font-medium text-right">CPL</th>
                    <th className="px-4 py-2.5 font-medium text-right">CAC</th>
                    <th className="px-4 py-2.5 font-medium text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.rows.slice(0, 8).map((row) => {
                    const cplCents = row.leads > 0 ? Math.round(row.spendCents / row.leads) : 0;
                    const cacCents = row.purchases > 0 ? Math.round(row.spendCents / row.purchases) : 0;
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-brand/8 dark:hover:bg-brand/12">
                        <td className="max-w-[18rem] px-4 py-3">
                          <p className="truncate font-semibold">{row.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.adsetName}</p>
                        </td>
                        <td className="max-w-[16rem] truncate px-4 py-3 text-muted-foreground">{row.campaignName}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrencyBRL(row.spendCents)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.purchases}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="tabular-nums font-semibold">{row.crmSales ?? 0}</span>
                          {(row.crmRevenueCents ?? 0) > 0 && (
                            <p className="text-xs text-muted-foreground">{formatCurrencyBRL(row.crmRevenueCents ?? 0)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{cplCents > 0 ? formatCurrencyBRL(cplCents) : "—"}</td>
                        <td className="px-4 py-3 text-right">{cacCents > 0 ? formatCurrencyBRL(cacCents) : "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.roas.toFixed(2)}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

function MetaNotice({
  title,
  message,
  tone = "neutral",
}: {
  title: string;
  message: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "danger"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-brand/20 bg-brand/10 text-foreground",
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className={cn("mt-0.5 text-xs", tone === "danger" ? "text-destructive/85" : "text-muted-foreground")}>
          {message}
        </p>
      </div>
    </div>
  );
}

function MiniMetric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand/12 text-brand ring-1 ring-brand/20">
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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
