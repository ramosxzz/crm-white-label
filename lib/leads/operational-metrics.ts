export type QualificationMetrics = {
  total: number;
  rated: number;
  unrated: number;
  average: number;
  distribution: { stars: number; count: number; percentage: number }[];
};

export function buildQualificationMetrics(values: Array<number | null | undefined>): QualificationMetrics {
  const counts = [0, 0, 0, 0, 0, 0];
  let starSum = 0;
  for (const raw of values) {
    const stars = Math.min(5, Math.max(0, Number(raw) || 0));
    counts[stars] += 1;
    starSum += stars;
  }
  const total = values.length;
  const unrated = counts[0];
  const rated = total - unrated;
  return {
    total,
    rated,
    unrated,
    average: rated > 0 ? starSum / rated : 0,
    distribution: counts.map((count, stars) => ({
      stars,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    })),
  };
}

export function buildStageDistribution(
  counts: Array<{ stage_id: string | null; count: number }>,
  stages: Array<{ id: string; name: string; color: string | null }>,
  total: number,
) {
  const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
  return counts
    .filter((item) => item.count > 0)
    .map((item) => {
      const stage = item.stage_id ? stageMap.get(item.stage_id) : null;
      return {
        id: item.stage_id ?? "unassigned",
        name: stage?.name ?? "Sem etapa",
        color: stage?.color ?? "#64748b",
        count: item.count,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
      };
    });
}

export function buildCallFunnelCounts(
  totalCalls: number,
  leads: Array<{
    id: string;
    value_cents: number | null;
    tags: string[] | null;
    stage_id: string | null;
  }>,
  wonStageIds: Set<string>,
) {
  const distinct = new Map(leads.map((lead) => [lead.id, lead]));
  const rows = [...distinct.values()];
  return {
    feita: totalCalls,
    passou_valor: rows.filter((lead) => (lead.value_cents ?? 0) > 0).length,
    qualificado: rows.filter((lead) =>
      (lead.tags ?? []).some((tag) => tag.trim().toLowerCase() === "qualificado"),
    ).length,
    fechado: rows.filter((lead) => Boolean(lead.stage_id && wonStageIds.has(lead.stage_id))).length,
  };
}
