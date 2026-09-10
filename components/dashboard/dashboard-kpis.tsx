import { ArrowDownRight, ArrowUpRight, Handshake, TrendingUp, UserPlus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyBRL, cn } from "@/lib/utils";
import type { PeriodFilter } from "@/lib/date/period-filter";

function trendFrom(current: number, previous: number | null): number | null {
  if (previous === null) return null;
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function DashboardKpis({
  newLeadsInPeriod,
  newLeadsPreviousPeriod,
  inProgress,
  openOpportunities,
  wonInPeriod,
  wonValueInPeriodCents,
  period,
}: {
  newLeadsInPeriod: number;
  newLeadsPreviousPeriod: number | null;
  inProgress: number;
  openOpportunities: number;
  wonInPeriod: number;
  wonValueInPeriodCents: number;
  period: PeriodFilter;
}) {
  const leadsTrend = trendFrom(newLeadsInPeriod, newLeadsPreviousPeriod);
  const previousLabel = period === "all" ? undefined : "vs. período anterior";

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard icon={<UserPlus className="h-4 w-4" />} label="Leads novos" value={newLeadsInPeriod} trend={leadsTrend} trendLabel={previousLabel} />
      <KpiCard icon={<Users className="h-4 w-4" />} label="Em atendimento" value={inProgress} hint="leads já engajados, fora a entrada" />
      <KpiCard icon={<Handshake className="h-4 w-4" />} label="Oportunidades abertas" value={openOpportunities} hint="todo o pipeline em aberto" />
      <KpiCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Vendas / Ganhos"
        value={wonInPeriod}
        hint={wonValueInPeriodCents > 0 ? formatCurrencyBRL(wonValueInPeriodCents) : undefined}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  trend,
  trendLabel,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: number | null;
  trendLabel?: string;
  hint?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/20">
            {icon}
          </div>
          {trend !== undefined && trend !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                trend >= 0 ? "text-success" : "text-destructive",
              )}
              title={trendLabel}
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
