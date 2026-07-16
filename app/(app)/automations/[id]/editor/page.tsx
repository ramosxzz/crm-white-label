import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { FlowEditor } from "@/components/automations/flow-editor";

export default async function AutomationEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const [{ data: flow }, { data: version }, { data: quickMessages }, { data: pipelines }] = await Promise.all([
    supabase
      .from("automation_flows")
      .select("id, name, status")
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .single(),
    // Get latest version (draft or published)
    supabase
      .from("automation_versions")
      .select("config")
      .eq("flow_id", id)
      .eq("tenant_id", ctx.tenantId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("quick_messages")
      .select("id, title")
      .eq("tenant_id", ctx.tenantId)
      .order("sort_order"),
    supabase
      .from("pipelines")
      .select("id, name, pipeline_stages(id, name, position)")
      .eq("tenant_id", ctx.tenantId)
      .order("name", { ascending: true }),
  ]);

  if (!flow) notFound();

  const pipelineOptions = (pipelines ?? []).map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    stages: [...(pipeline.pipeline_stages ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((stage) => ({
        id: stage.id,
        name: stage.name,
        position: stage.position ?? null,
      })),
  }));

  const config = (version?.config as { blocks?: unknown[]; connections?: unknown[] } | null) ?? {
    blocks: [],
    connections: [],
  };

  return (
    <FlowEditor
      flowId={flow.id}
      flowName={flow.name}
      flowStatus={flow.status}
      initialBlocks={(config.blocks ?? []) as Parameters<typeof FlowEditor>[0]["initialBlocks"]}
      initialConnections={
        (config.connections ?? []) as Parameters<typeof FlowEditor>[0]["initialConnections"]
      }
      quickMessages={quickMessages ?? []}
      pipelineOptions={pipelineOptions}
    />
  );
}
