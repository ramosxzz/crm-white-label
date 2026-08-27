import { getBRTDayBounds, getBRTYesterdayBounds } from "@/lib/date/brt";
import type { PeriodFilter } from "@/lib/date/period-filter";

export type LeadsDashboardData = {
  dateLabel: string;
  today: { startIso: string; endIso: string };
  kpis: {
    newLeadsToday: number;
    newLeadsYesterday: number;
    outboundMessagesToday: number;
    activeConversationsToday: number;
    wonToday: number;
    wonValueTodayCents: number;
    pipelineValueTodayCents: number;
  };
  operations: {
    sharedQueueLeads: number;
    appointmentsToday: number;
    overdueTasks: number;
    lowStockProducts: number;
    activeReservations: number;
  };
  leadsByHour: { hour: string; count: number }[];
  pipelineByStage: { id: string; name: string; color: string; count: number; isWon: boolean; isLost: boolean }[];
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
  weekTrend: { date: string; label: string; count: number }[];
  starsDistribution: { stars: number; count: number }[];
  starsAverage: number;
  starsByPeriod: Partial<Record<PeriodFilter, {
    distribution: { stars: number; count: number }[];
    average: number;
  }>>;
  /** Periodo ativo do cartao de funil (rosca), por data de criacao do lead. */
  funnelPeriod: PeriodFilter;
  /** Periodo ativo do cartao de estrelas, por data de criacao do lead. */
  starsPeriod: PeriodFilter;
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

export function aggregateStars(leads: { quality_stars: number | null }[]) {
  const counts = [0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const lead of leads) {
    const stars = Math.min(5, Math.max(0, lead.quality_stars ?? 0));
    counts[stars]++;
    total += stars;
  }
  const distribution = counts.map((count, stars) => ({ stars, count }));
  const rated = leads.length - counts[0];
  const average = rated > 0 ? total / rated : 0;
  return { distribution, average };
}

export function aggregateStarsForBounds(
  leads: { quality_stars: number | null; created_at: string }[],
  bounds: { startIso: string; endIso: string } | null,
) {
  if (!bounds) return aggregateStars(leads);
  const start = new Date(bounds.startIso).getTime();
  const end = new Date(bounds.endIso).getTime();
  return aggregateStars(leads.filter((lead) => {
    const createdAt = new Date(lead.created_at).getTime();
    return createdAt >= start && createdAt <= end;
  }));
}

export function buildWeekTrend(leads: { created_at: string }[]) {
  const days: { date: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const label = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" });
    days.push({
      date: dateStr,
      label,
      count: leads.filter((l) => l.created_at.slice(0, 10) === dateStr).length,
    });
  }
  return days;
}

export { getBRTDayBounds, getBRTYesterdayBounds };
