import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canSeeFullDashboard } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import {
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
  getBRTRollingDayBounds,
  getBRTYesterdayBounds,
} from "@/lib/date/brt";
import { FunnelView, type FunnelStage, type FunnelTotals } from "./funnel-view";

export type FunnelDateFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";

function resolveFunnelDateFilter(periodo?: string, dia?: string) {
  const active = (["today", "yesterday", "7d", "30d", "all", "custom"].includes(periodo ?? "")
    ? periodo
    : "all") as FunnelDateFilter;

  if (active === "today") return { active, bounds: getBRTDayBounds() };
  if (active === "yesterday") return { active, bounds: getBRTYesterdayBounds() };
  if (active === "7d") return { active, bounds: getBRTRollingDayBounds(7) };
  if (active === "30d") return { active, bounds: getBRTRollingDayBounds(30) };
  if (active === "custom" && dia) {
    const bounds = getBRTDayBoundsFromDateString(dia);
    if (bounds) return { active, bounds };
  }
  return { active: "all" as FunnelDateFilter, bounds: null };
}

type FunnelRow = {
  stage_id: string;
  stage_name: string;
  stage_color: string | null;
  stage_position: number;
  is_won: boolean;
  is_lost: boolean;
  lead_count: number | string;
  value_cents: number | string;
  avg_seconds: number | string;
};

export default async function FunilPage({
  searchParams,
}: {
  searchParams?: Promise<{ pipeline?: string; periodo?: string; dia?: string }>;
}) {
  const ctx = await requireContext();
  if (!canSeeFullDashboard(ctx.role)) redirect("/dashboard");

  const supabase = await createClient();
  const params = await searchParams;
  const dateFilter = resolveFunnelDateFilter(params?.periodo, params?.dia);

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, is_default")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at");

  const activePipeline =
    pipelines?.find((p) => p.id === params?.pipeline) ??
    pipelines?.find((p) => p.is_default) ??
    pipelines?.[0];

  const { data } = await supabase.rpc("funnel_metrics", {
    p_tenant_id: ctx.tenantId,
    p_pipeline_id: activePipeline?.id ?? null,
    p_from: dateFilter.bounds?.startIso ?? null,
    p_to: dateFilter.bounds?.endIso ?? null,
  });

  const stages: FunnelStage[] = ((data ?? []) as FunnelRow[]).map((row) => ({
    id: row.stage_id,
    name: row.stage_name,
    color: row.stage_color ?? "#94a3b8",
    count: Number(row.lead_count ?? 0),
    valueCents: Number(row.value_cents ?? 0),
    avgSeconds: Number(row.avg_seconds ?? 0),
    isWon: row.is_won,
    isLost: row.is_lost,
  }));

  const totals = stages.reduce<FunnelTotals>(
    (acc, stage) => {
      acc.createdCount += stage.count;
      acc.createdValueCents += stage.valueCents;
      if (stage.isWon) {
        acc.wonCount += stage.count;
        acc.wonValueCents += stage.valueCents;
      } else if (stage.isLost) {
        acc.lostCount += stage.count;
        acc.lostValueCents += stage.valueCents;
      } else {
        acc.openCount += stage.count;
        acc.openValueCents += stage.valueCents;
      }
      return acc;
    },
    {
      createdCount: 0,
      createdValueCents: 0,
      wonCount: 0,
      wonValueCents: 0,
      lostCount: 0,
      lostValueCents: 0,
      openCount: 0,
      openValueCents: 0,
    },
  );

  return (
    <div>
      <PageHeader
        eyebrow="Analise"
        title="Funil de vendas"
        description="Volume, valor e tempo medio em cada etapa do funil."
      />
      <div className="p-8">
        <FunnelView
          stages={stages}
          totals={totals}
          pipelines={pipelines ?? []}
          activePipelineId={activePipeline?.id ?? null}
          activeDateFilter={dateFilter.active}
          customDay={params?.dia}
        />
      </div>
    </div>
  );
}
