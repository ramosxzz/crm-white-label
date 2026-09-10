import { Star } from "lucide-react";

export type QualificationDistribution = { stars: number; count: number }[];

export function QualificationSummary({ total, distribution }: { total: number; distribution: QualificationDistribution }) {
  const countByStars = new Map(distribution.map((item) => [item.stars, item.count]));
  const count = (stars: number) => countByStars.get(stars) ?? 0;
  const rated = [1, 2, 3, 4, 5].reduce((sum, stars) => sum + count(stars), 0);
  const qualified = count(3) + count(4) + count(5);
  const highlyQualified = count(4) + count(5);
  const average = rated > 0
    ? [1, 2, 3, 4, 5].reduce((sum, stars) => sum + stars * count(stars), 0) / rated
    : 0;
  const percentage = (value: number) => total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <section className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-elev-1" aria-labelledby="qualification-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="qualification-title" className="flex items-center gap-2 text-sm font-semibold">
            <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Qualificação dos leads
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Percentuais calculados sobre os {total.toLocaleString("pt-BR")} leads do resultado atual, não apenas desta página.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Metric label="3+ estrelas" value={qualified} percentage={percentage(qualified)} />
          <Metric label="4–5 estrelas" value={highlyQualified} percentage={percentage(highlyQualified)} />
          <Metric label="Média dos avaliados" value={average.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {[5, 4, 3, 2, 1, 0].map((stars) => {
          const value = count(stars);
          const share = percentage(value);
          return (
            <div key={stars} className="min-w-0 rounded-lg border border-border/60 bg-background/45 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">{stars === 0 ? "Sem avaliação" : `${stars} estrela${stars === 1 ? "" : "s"}`}</span>
                <strong className="tabular-nums">{value.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
              </div>
              <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">{share}%</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, percentage }: { label: string; value: number | string; percentage?: number }) {
  return (
    <div className="min-w-[112px]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        {percentage !== undefined && <span className="ml-1 font-normal text-muted-foreground">({percentage}%)</span>}
      </p>
    </div>
  );
}
