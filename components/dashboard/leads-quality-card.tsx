"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERIOD_FILTER_OPTIONS, type PeriodFilter } from "@/lib/date/period-filter";
import { cn } from "@/lib/utils";

type StarsData = {
  distribution: { stars: number; count: number }[];
  average: number;
};

export function LeadsQualityCard({
  initialPeriod,
  initialData,
  dataByPeriod,
}: {
  initialPeriod: PeriodFilter;
  initialData: StarsData;
  dataByPeriod: Partial<Record<PeriodFilter, StarsData>>;
}) {
  const [active, setActive] = useState(initialPeriod);
  const data = dataByPeriod[active] ?? initialData;
  const total = data.distribution.reduce((sum, item) => sum + item.count, 0);
  const unrated = data.distribution.find((item) => item.stars === 0)?.count ?? 0;
  const rated = total - unrated;
  const mql = data.distribution
    .filter((item) => item.stars >= 3)
    .reduce((sum, item) => sum + item.count, 0);
  const options = PERIOD_FILTER_OPTIONS.filter((option) =>
    ["today", "7d", "30d", "this_month", "all"].includes(option.value),
  );

  function selectPeriod(period: PeriodFilter) {
    if (!dataByPeriod[period]) return;
    setActive(period);
    const url = new URL(window.location.href);
    if (period === "all") url.searchParams.delete("estrelas");
    else url.searchParams.set("estrelas", period);
    url.hash = "";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }

  return (
    <Card className="min-w-0 lg:col-span-5">
      <CardHeader className="space-y-3">
        <div className="space-y-1.5">
          <CardTitle>Qualidade dos leads</CardTitle>
          <CardDescription>
            {data.average > 0
              ? `Média ${data.average.toFixed(1)} estrelas (leads avaliados)`
              : "Distribuição por estrelas atribuídas"}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1" aria-label="Período da qualidade dos leads">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectPeriod(option.value)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                active === option.value
                  ? "border-brand/40 bg-brand/15 text-brand"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-hidden">
        {total === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-8 text-sm text-muted-foreground">
            Nenhum lead cadastrado no período.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-center text-xs">
              <div className="min-w-0"><strong className="block text-base text-foreground">{total}</strong>Total</div>
              <div className="min-w-0"><strong className="block text-base text-foreground">{rated}</strong>Avaliados</div>
              <div className="min-w-0"><strong className="block text-base text-foreground">{mql}</strong><span className="block truncate">MQLs (3+ estrelas)</span></div>
            </div>
            {[...data.distribution].reverse().map(({ stars, count }) => {
              const percentage = Math.round((count / total) * 100);
              return (
                <div key={stars} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 font-medium">
                      {stars === 0 ? "Sem avaliação" : Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cn(
                            "h-3.5 w-3.5",
                            index < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                          )}
                        />
                      ))}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{count} · {percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-200", stars === 0 ? "bg-muted-foreground/40" : "bg-amber-400")}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
