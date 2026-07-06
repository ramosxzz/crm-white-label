import { requireContext } from "@/lib/tenant";
import { listConversationItemsForTenant } from "@/lib/chat/list-conversation-items";
import { ConversationListLive } from "@/components/chat/conversation-list-live";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const items = await listConversationItemsForTenant(ctx.tenantId);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden bg-background">
      <ConversationListLive tenantId={ctx.tenantId} initialItems={items} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
