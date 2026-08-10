import {
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
  getBRTMonthBounds,
  getBRTRollingDayBounds,
  getBRTYesterdayBounds,
} from "@/lib/date/brt";

/**
 * Filtro de periodo compartilhado entre o funil e os cartoes do dashboard.
 *
 * Estava duplicado dentro da pagina do funil. Como o dashboard passou a usar o
 * mesmo conjunto de opcoes, duas copias divergiriam com o tempo - "7 dias"
 * significando coisas diferentes em telas vizinhas e ninguem entendendo por que
 * os numeros nao batem.
 */

export type PeriodFilter =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "custom";

export const PERIOD_FILTER_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "all", label: "Todos" },
];

const VALID: PeriodFilter[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "this_month",
  "last_month",
  "all",
  "custom",
];

export type PeriodBounds = { startIso: string; endIso: string } | null;

/**
 * `bounds` nulo significa "sem recorte" - quem consome deve tratar como todos
 * os registros, nao como intervalo vazio.
 */
export function resolvePeriodFilter(
  periodo?: string,
  dia?: string,
  fallback: PeriodFilter = "all",
): { active: PeriodFilter; bounds: PeriodBounds } {
  const active = (VALID.includes((periodo ?? "") as PeriodFilter)
    ? (periodo as PeriodFilter)
    : fallback) as PeriodFilter;

  if (active === "today") return { active, bounds: getBRTDayBounds() };
  if (active === "yesterday") return { active, bounds: getBRTYesterdayBounds() };
  if (active === "7d") return { active, bounds: getBRTRollingDayBounds(7) };
  if (active === "30d") return { active, bounds: getBRTRollingDayBounds(30) };
  if (active === "this_month") return { active, bounds: getBRTMonthBounds(0) };
  if (active === "last_month") return { active, bounds: getBRTMonthBounds(-1) };
  if (active === "custom" && dia) {
    const bounds = getBRTDayBoundsFromDateString(dia);
    if (bounds) return { active, bounds };
  }
  return { active: "all", bounds: null };
}

export function periodLabel(active: PeriodFilter, dia?: string): string {
  if (active === "custom" && dia) {
    const [y, m, d] = dia.split("-");
    return d && m && y ? `${d}/${m}/${y}` : "Dia específico";
  }
  return PERIOD_FILTER_OPTIONS.find((o) => o.value === active)?.label ?? "Todos";
}
