"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, TrendingDown, TrendingUp, Plus, CircleDot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL, cn } from "@/lib/utils";

type DateFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "custom";

const DATE_FILTER_OPTIONS: Array<{ value: DateFilter; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "all", label: "Todos" },
];

export type FunnelStage = {
  id: string;
  name: string;
  color: string;
  count: number;
  valueCents: number;
  avgSeconds: number;
  isWon: boolean;
  isLost: boolean;
};

export type FunnelTotals = {
  createdCount: number;
  createdValueCents: number;
  wonCount: number;
  wonValueCents: number;
  lostCount: number;
  lostValueCents: number;
  openCount: number;
  openValueCents: number;
};

/** "6 dias", "5 horas", "12 minutos" - mesma linguagem do painel de referencia. */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 minutos";
  const days = seconds / 86400;
  if (days >= 1) {
    const value = Math.round(days);
    return `${value} ${value === 1 ? "dia" : "dias"}`;
  }
  const hours = seconds / 3600;
  if (hours >= 1) {
    const value = Math.round(hours);
    return `${value} ${value === 1 ? "hora" : "horas"}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

const COLUMN_WIDTH = 260;
const CHART_HEIGHT = 260;

export function FunnelView({
  stages,
  totals,
  pipelines,
  activePipelineId,
  activeDateFilter,
  customDay,
}: {
  stages: FunnelStage[];
  totals: FunnelTotals;
  pipelines: { id: string; name: string }[];
  activePipelineId: string | null;
  activeDateFilter: DateFilter;
  customDay?: string;
}) {
  const router = useRouter();
  const [pipelinePending, startPipelineNav] = useTransition();

  function dateHref(periodo: DateFilter, dia?: string) {
    const qs = new URLSearchParams();
    if (activePipelineId) qs.set("pipeline", activePipelineId);
    qs.set("periodo", periodo);
    if (periodo === "custom" && dia) qs.set("dia", dia);
    return `/funil?${qs.toString()}`;
  }

  const maxCount = useMemo(() => Math.max(1, ...stages.map((s) => s.count)), [stages]);

  // Cada segmento vai da altura da etapa atual ate a da proxima, formando o
  // afunilamento. A % e a conversao em relacao a etapa anterior.
  const segments = useMemo(() => {
    return stages.map((stage, index) => {
      const next = stages[index + 1];
      const heightStart = Math.max(6, (stage.count / maxCount) * CHART_HEIGHT);
      const heightEnd = next ? Math.max(6, (next.count / maxCount) * CHART_HEIGHT) : heightStart;
      const previous = stages[index - 1];
      const conversion =
        previous && previous.count > 0 ? Math.round((stage.count / previous.count) * 100) : null;
      return { stage, heightStart, heightEnd, conversion };
    });
  }, [stages, maxCount]);

  const chartWidth = Math.max(1, stages.length) * COLUMN_WIDTH;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {DATE_FILTER_OPTIONS.map((option) => (
            <Link
              key={option.value}
              href={dateHref(option.value)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                activeDateFilter === option.value
                  ? "border-brand/40 bg-brand/15 text-brand"
                  : "border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <form action="/funil" className="flex items-center gap-2">
          <input type="hidden" name="periodo" value="custom" />
          {activePipelineId && <input type="hidden" name="pipeline" value={activePipelineId} />}
          <Input
            type="date"
            name="dia"
            defaultValue={activeDateFilter === "custom" ? customDay : undefined}
            className={cn("h-9 w-44", activeDateFilter === "custom" && "border-brand/60")}
          />
          <Button size="sm" variant="secondary" type="submit">
            Filtrar dia
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TotalCard
          label="Total criados"
          valueCents={totals.createdValueCents}
          count={totals.createdCount}
          icon={<Plus className="h-5 w-5 text-muted-foreground" />}
        />
        <TotalCard
          label="Total ganhos"
          valueCents={totals.wonValueCents}
          count={totals.wonCount}
          icon={<TrendingUp className="h-5 w-5 text-success" />}
        />
        <TotalCard
          label="Total perdidos"
          valueCents={totals.lostValueCents}
          count={totals.lostCount}
          icon={<TrendingDown className="h-5 w-5 text-destructive" />}
        />
        <TotalCard
          label="Total em aberto"
          valueCents={totals.openValueCents}
          count={totals.openCount}
          icon={<CircleDot className="h-5 w-5 text-brand" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg font-semibold">Gráfico de funil</h2>
            {pipelines.length > 1 && (
              <select
                value={activePipelineId ?? ""}
                onChange={(e) => {
                  const pipelineId = e.target.value;
                  startPipelineNav(() => router.push(`/funil?pipeline=${pipelineId}`));
                }}
                disabled={pipelinePending}
                className="h-9 rounded-md border border-border bg-card px-3 text-sm font-medium outline-none transition-colors focus:border-brand disabled:opacity-60"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {stages.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-muted-foreground">
              Nenhuma etapa configurada neste funil.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ width: chartWidth }} className="min-w-full">
                <div className="flex">
                  {segments.map(({ stage }) => (
                    <div
                      key={stage.id}
                      style={{ width: COLUMN_WIDTH }}
                      className="shrink-0 border-r border-border/50 px-5 py-4 last:border-r-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {stage.name}
                        </span>
                      </div>
                      <p className="mt-2 font-display text-2xl font-semibold">
                        {formatCurrencyBRL(stage.valueCents)}
                      </p>
                      <dl className="mt-3 space-y-1 border-t border-border/50 pt-2 text-xs">
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">Quantidade</dt>
                          <dd className="font-medium">
                            {stage.count === 0
                              ? "Nenhum negócio"
                              : `${stage.count} ${stage.count === 1 ? "Negócio" : "Negócios"}`}
                          </dd>
                        </div>
                        {totals.createdCount > 0 && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">Do total do período</dt>
                            <dd className="font-semibold" style={{ color: stage.color }}>
                              {Math.round((stage.count / totals.createdCount) * 100)}%
                            </dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">Tempo médio</dt>
                          <dd className="font-medium">{formatDuration(stage.avgSeconds)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                <svg
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
                  className="block"
                  role="img"
                  aria-label="Grafico de funil por etapa"
                >
                  {segments.map(({ stage, heightStart, heightEnd, conversion }, index) => {
                    const x = index * COLUMN_WIDTH;
                    const topStart = (CHART_HEIGHT - heightStart) / 2;
                    const topEnd = (CHART_HEIGHT - heightEnd) / 2;
                    const path = [
                      `M ${x} ${topStart}`,
                      `C ${x + COLUMN_WIDTH / 2} ${topStart}, ${x + COLUMN_WIDTH / 2} ${topEnd}, ${x + COLUMN_WIDTH} ${topEnd}`,
                      `L ${x + COLUMN_WIDTH} ${topEnd + heightEnd}`,
                      `C ${x + COLUMN_WIDTH / 2} ${topEnd + heightEnd}, ${x + COLUMN_WIDTH / 2} ${topStart + heightStart}, ${x} ${topStart + heightStart}`,
                      "Z",
                    ].join(" ");
                    return (
                      <g key={stage.id}>
                        <path d={path} fill={stage.color} opacity={0.85} />
                        {conversion !== null && (
                          <g>
                            <rect
                              x={x + COLUMN_WIDTH / 2 - 26}
                              y={CHART_HEIGHT / 2 - 11}
                              width={52}
                              height={22}
                              rx={11}
                              className="fill-background"
                            />
                            <text
                              x={x + COLUMN_WIDTH / 2}
                              y={CHART_HEIGHT / 2 + 4}
                              textAnchor="middle"
                              className="fill-foreground text-[11px] font-semibold"
                            >
                              {conversion}%
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TotalCard({
  label,
  valueCents,
  count,
  icon,
}: {
  label: string;
  valueCents: number;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{formatCurrencyBRL(valueCents)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {count} {count === 1 ? "negócio" : "negócios"}
            </p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
