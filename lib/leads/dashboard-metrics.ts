import { getBRTDayBounds, getBRTYesterdayBounds } from "@/lib/date/brt";
import type { PeriodFilter } from "@/lib/date/period-filter";

export type PipelineStage = {
  id: string;
  name: string;
  color: string;
  count: number;
  valueCents: number | null;
  isWon: boolean;
  isLost: boolean;
};

export type AttentionItem = {
  id: string;
  label: string;
  count: number;
  tone: "critical" | "warning" | "info";
  href: string;
};

export type LeadsDashboardData = {
  dateLabel: string;
  userFirstName: string;
  today: { startIso: string; endIso: string };
  kpis: {
    /** Leads criados no periodo global selecionado (nao so "hoje"). */
    newLeadsInPeriod: number;
    /** Mesma contagem, na janela equivalente imediatamente anterior - base da tendencia. Null quando o periodo e "todos" (sem janela anterior que faca sentido). */
    newLeadsPreviousPeriod: number | null;
    inProgress: number;
    openOpportunities: number;
    wonInPeriod: number;
    wonValueInPeriodCents: number;
  };
  operations: {
    sharedQueueLeads: number;
    appointmentsToday: number;
    overdueTasks: number;
    lowStockProducts: number;
    activeReservations: number;
  };
  attention: AttentionItem[];
  leadsByHour: { hour: string; count: number }[];
  pipelineByStage: PipelineStage[];
  sourcesToday: { source: string; count: number }[];
  recentToday: {
    id: string;
    name: string;
    phone: string | null;
    source: string | null;
    created_at: string;
    stageName: string | null;
    stageColor: string | null;
    value_cents: number | null;
  }[];
  leadsWeekTrend: { date: string; label: string; count: number }[];
  wonWeekTrend: { date: string; label: string; count: number }[];
  /** Periodo ativo do pipeline/atividade comercial (compartilhado, nao mais um filtro por cartao). */
  period: PeriodFilter;
  /** Parametros atuais da URL, pra os filtros nao apagarem uns aos outros. */
  periodParams: Record<string, string | undefined>;
};

export function buildLeadsByHour(leads: { created_at: string }[], startIso: string) {
  const start = new Date(startIso);
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}h`,
    count: 0,
  }));

  for (const lead of leads) {
    const t = new Date(lead.created_at).toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    });
    const h = parseInt(t, 10);
    if (!Number.isNaN(h) && h >= 0 && h < 24) buckets[h].count += 1;
  }

  const currentHour = new Date().toLocaleString("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
  });
  const nowH = parseInt(currentHour, 10);
  return buckets.slice(0, Math.max(nowH + 1, 6));
}

export function aggregateSources(leads: { source: string | null }[]) {
  const map = new Map<string, number>();
  for (const l of leads) {
    const key = l.source?.trim() || "Sem origem";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

function buildDayTrend<T>(
  rows: T[],
  getDate: (row: T) => string | null,
  reduce: (rows: T[]) => number,
) {
  const days: { date: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const label = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" });
    const dayRows = rows.filter((row) => getDate(row)?.slice(0, 10) === dateStr);
    days.push({ date: dateStr, label, count: reduce(dayRows) });
  }
  return days;
}

export function buildWeekTrend(leads: { created_at: string }[]) {
  return buildDayTrend(leads, (l) => l.created_at, (rows) => rows.length);
}

/** Mesma janela de 7 dias, mas contando negocios ganhos por `won_at`. */
export function buildWonWeekTrend(wonLeads: { won_at: string | null }[]) {
  return buildDayTrend(wonLeads, (l) => l.won_at, (rows) => rows.length);
}

export { getBRTDayBounds, getBRTYesterdayBounds };
