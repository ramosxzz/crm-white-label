import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canSeeAllLeads } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { fetchLeadCallCountsForTenant } from "@/lib/integrations/call-counts";
import { KanbanBoard } from "./kanban-board";

export default async function KanbanPage({ searchParams }: { searchParams?: Promise<{ pipeline?: string }> }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const params = await searchParams;
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, name, is_default")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at");
  const activePipeline =
    pipelines?.find((pipeline) => pipeline.id === params?.pipeline) ??
    pipelines?.find((pipeline) => pipeline.is_default) ??
    pipelines?.[0];

  const restrictToOwn = ctx.tenant.lead_assignment_enabled && !canSeeAllLeads(ctx.role);

  const [{ data: stages }, { data: leads }] = activePipeline
    ? await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("id, name, color, position")
          .eq("tenant_id", ctx.tenantId)
          .eq("pipeline_id", activePipeline.id)
          .order("position"),
        (() => {
          let q = supabase
            .from("leads")
            .select("id, name, phone, value_cents, stage_id, position, source, tags, quality_stars, created_at")
            .eq("tenant_id", ctx.tenantId)
            .eq("pipeline_id", activePipeline.id);
          if (restrictToOwn) q = q.eq("assigned_to", ctx.userId);
          return q.order("position");
        })(),
      ])
    : [{ data: [] }, { data: [] }];

  const callCounts = await fetchLeadCallCountsForTenant(ctx.tenantId, {
    includeApi4com: ctx.tenant.calls_dashboard_enabled,
  });

  return (
    <div className="flex h-screen flex-col">
      <PageHeader eyebrow="Pipeline" title="Kanban" description="Arraste os leads entre os estagios" />
      <div className="flex-1 overflow-hidden p-6">
        <KanbanBoard
          key={activePipeline?.id ?? "empty"}
          pipelines={pipelines ?? []}
          activePipelineId={activePipeline?.id ?? null}
          initialStages={stages ?? []}
          initialLeads={leads ?? []}
          callCounts={callCounts}
          callsEnabled={ctx.tenant.calls_dashboard_enabled}
          tenantId={ctx.tenantId}
        />
      </div>
    </div>
  );
}
