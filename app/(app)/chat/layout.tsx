import { requireContext } from "@/lib/tenant";
import { listConversationItemsForTenant } from "@/lib/chat/list-conversation-items";
import { ConversationListLive } from "@/components/chat/conversation-list-live";
import { createClient } from "@/lib/supabase/server";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  type InstanceRow = { id: string; display_name: string | null; phone_number: string };
  type StageRow = { id: string; name: string };

  const [items, instancesResult, stagesResult] = await Promise.all([
    listConversationItemsForTenant(ctx.tenantId, 300, {}, ctx.tenant.name),
    supabase
      .from("whatsapp_accounts")
      .select("id, display_name, phone_number")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at"),
    supabase
      .from("pipeline_stages")
      .select("id, name, pipelines!inner(tenant_id)")
      .eq("pipelines.tenant_id", ctx.tenantId)
      .order("position"),
  ]);
  const instances = (instancesResult.data ?? []) as unknown as InstanceRow[];
  const stages = (stagesResult.data ?? []) as unknown as StageRow[];

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.75rem-env(safe-area-inset-bottom))] min-h-0 overflow-hidden bg-background md:h-[calc(100vh-3.5rem)]">
      <ConversationListLive
        tenantId={ctx.tenantId}
        initialItems={items}
        instances={instances.map((i) => ({
          id: i.id,
          label: i.display_name || i.phone_number,
        }))}
        stages={stages.map((s) => ({ id: s.id, name: s.name }))}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
