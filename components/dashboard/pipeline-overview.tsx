import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardPeriodFilter } from "@/components/dashboard/card-period-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { PeriodFilter } from "@/lib/date/period-filter";
import type { PipelineStage } from "@/lib/leads/dashboard-metrics";

/**
 * Antes era uma barra horizontal numa escala linear so - com 4062 leads em
 * "Novo Lead" e 1 digito nas outras etapas, tudo que nao fosse a primeira
 * barra virava um traco de poucos pixels, ilegivel. Aqui cada etapa e um
 * cartao com a propria largura de barra de progresso (proporcional ao
 * maximo, mas com piso minimo visivel), entao etapa nenhuma desaparece.
 */
export function PipelineOverview({
  stages,
  period,
  periodParams,
}: {
  stages: PipelineStage[];
  period: PeriodFilter;
  periodParams: Record<string, string | undefined>;
}) {
  const total = stages.reduce((a, s) => a + s.count, 0);
  const open = stages.filter((s) => !s.isWon && !s.isLost);
  const won = stages.filter((s) => s.isWon).reduce((a, s) => a + s.count, 0);
  const lost = stages.filter((s) => s.isLost).reduce((a, s) => a + s.count, 0);
  const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  // Valor por etapa so vem quando o periodo tem recorte de data (RPC
  // funnel_metrics) - no snapshot completo (funnel_metrics) o RPC nao
  // calcula valor, entao nao mostra nada em vez de fingir um numero.
  const openValueCents = open.reduce((a, s) => a + (s.valueCents ?? 0), 0);
  const hasValueData = open.some((s) => s.valueCents !== null);
  const wonWithValue = stages.filter((s) => s.isWon && s.valueCents !== null);
  const avgTicketCents =
    wonWithValue.length > 0 && won > 0
      ? Math.round(wonWithValue.reduce((a, s) => a + (s.valueCents ?? 0), 0) / won)
      : null;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Funil atual</CardTitle>
          <CardDescription>
            {total} leads distribuídos ·{" "}
            {period === "all" ? "snapshot do pipeline" : "leads criados no período, na etapa em que estão hoje"}
          </CardDescription>
        </div>
        <CardPeriodFilter param="funil" active={period} baseParams={periodParams} />
      </CardHeader>
      <CardContent className="space-y-5">
        {total === 0 ? (
          <EmptyState message="Pipeline vazio — cadastre o primeiro lead." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat label="No pipeline" value={`${open.reduce((a, s) => a + s.count, 0)}`} />
              <MiniStat label="Taxa de conversão" value={conversionRate !== null ? `${conversionRate}%` : "—"} hint={won + lost > 0 ? `${won} ganho(s) · ${lost} perdido(s)` : undefined} />
              {hasValueData && <MiniStat label="Valor em negociação" value={formatCurrencyBRL(openValueCents)} />}
              {avgTicketCents !== null && <MiniStat label="Ticket médio" value={formatCurrencyBRL(avgTicketCents)} />}
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {stages.map((stage, i) => (
                <div key={stage.id} className="flex shrink-0 items-center gap-3">
                  <StageCard stage={stage} maxCount={maxCount} total={total} />
                  {i < stages.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StageCard({ stage, maxCount, total }: { stage: PipelineStage; maxCount: number; total: number }) {
  const pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
  const barPct = Math.max(6, Math.round((stage.count / maxCount) * 100));

  return (
    <div className="w-40 shrink-0 rounded-xl border border-border/60 bg-card p-3.5">
      <p className="truncate text-xs font-semibold" title={stage.name}>
        {stage.name}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{stage.count}</p>
      <p className="text-[11px] text-muted-foreground">{pct}% do total</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", stage.isWon ? "bg-success" : stage.isLost ? "bg-destructive" : "bg-brand")}
          style={{ width: `${barPct}%`, backgroundColor: !stage.isWon && !stage.isLost ? stage.color : undefined }}
        />
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
