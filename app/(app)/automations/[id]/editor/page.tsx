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

  const [{ data: flow }, { data: version }, { data: quickMessages }] = await Promise.all([
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
  ]);

  if (!flow) notFound();

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
    />
  );
}
