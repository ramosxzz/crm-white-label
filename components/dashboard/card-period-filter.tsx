import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIOD_FILTER_OPTIONS, type PeriodFilter } from "@/lib/date/period-filter";

/**
 * Filtro de periodo de um cartao isolado do dashboard.
 *
 * Cada cartao tem o seu, com parametro proprio na URL, porque as perguntas sao
 * independentes: da pra olhar as estrelas dos ultimos 30 dias enquanto o funil
 * mostra so hoje. Um filtro unico no topo obrigaria as duas leituras a andarem
 * juntas.
 *
 * Compacto de proposito - fica dentro do cabecalho do cartao, nao pode competir
 * com o dado.
 */
export function CardPeriodFilter({
  param,
  active,
  baseParams,
  compact = true,
}: {
  /** Nome do parametro na URL, ex.: "funil" ou "estrelas". */
  param: string;
  active: PeriodFilter;
  /** Demais parametros da pagina, preservados ao trocar de periodo. */
  baseParams?: Record<string, string | undefined>;
  compact?: boolean;
}) {
  function href(value: PeriodFilter) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(baseParams ?? {})) {
      if (val && key !== param) qs.set(key, val);
    }
    qs.set(param, value);
    return `/dashboard?${qs.toString()}#${param}`;
  }

  const options = compact
    ? PERIOD_FILTER_OPTIONS.filter((o) => o.value !== "yesterday" && o.value !== "last_month")
    : PERIOD_FILTER_OPTIONS;

  return (
    <div id={param} className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <Link
          key={option.value}
          href={href(option.value)}
          scroll={false}
          className={cn(
            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            active === option.value
              ? "border-brand/40 bg-brand/15 text-brand"
              : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
