import { formatCurrencyBRL } from "@/lib/utils";

export type StageBreakdown = { name: string; count: number }[];

/**
 * Faixa horizontal discreta - substitui os 4 cards + "Avanco das etapas" +
 * "Qualificacao dos leads" que dominavam a tela antes da tabela. So o que
 * ajuda a trabalhar leads agora, nao uma mini-dashboard.
 */
export function LeadsSummaryBar({
  total,
  totalLabel,
  stageBreakdown,
  valueCents,
}: {
  total: number;
  /** Quando os filtros usam contagem exata direta (busca/responsavel/origem/qualificacao), o RPC nao cobre - so mostra o total, sem detalhar etapas. */
  totalLabel: string;
  stageBreakdown: StageBreakdown | null;
  valueCents: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/60 bg-card/60 px-4 py-2.5 text-sm">
      <strong className="tabular-nums">{total.toLocaleString("pt-BR")}</strong>
      <span className="text-muted-foreground">{totalLabel}</span>
      {stageBreakdown && stageBreakdown.length > 0 && (
        <>
          <span className="text-muted-foreground/50">·</span>
          {stageBreakdown.map((s, i) => (
            <span key={s.name} className="text-muted-foreground">
              {i > 0 && <span className="mr-2 text-muted-foreground/50">·</span>}
              <strong className="tabular-nums text-foreground">{s.count}</strong> {s.name.toLowerCase()}
            </span>
          ))}
        </>
      )}
      {valueCents > 0 && (
        <>
          <span className="ml-auto text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">
            <strong className="tabular-nums text-foreground">{formatCurrencyBRL(valueCents)}</strong> em valor
          </span>
        </>
      )}
    </div>
  );
}
