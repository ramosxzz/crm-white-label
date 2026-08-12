import { GroupListLive } from "@/components/chat/group-list-live";
import { getChatAccountVisibility } from "@/lib/chat/list-conversation-items";
import { listWhatsAppGroupItemsForTenant } from "@/lib/chat/list-group-items";
import { requireContext } from "@/lib/tenant";

export default async function WhatsAppGroupsPage() {
  const ctx = await requireContext();
  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  const items = await listWhatsAppGroupItemsForTenant(ctx.tenantId, visibility);

  return <GroupListLive tenantId={ctx.tenantId} initialItems={items} />;
}
