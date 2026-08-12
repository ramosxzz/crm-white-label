import { GroupListLive } from "@/components/chat/group-list-live";
import { getChatAccountVisibility } from "@/lib/chat/list-conversation-items";
import { listWhatsAppGroupItemsForTenant } from "@/lib/chat/list-group-items";
import { listGroupLabels } from "../actions";
import { requireContext } from "@/lib/tenant";

export default async function WhatsAppGroupsPage() {
  const ctx = await requireContext();
  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  const [items, allLabels] = await Promise.all([
    listWhatsAppGroupItemsForTenant(ctx.tenantId, visibility),
    listGroupLabels(),
  ]);

  return <GroupListLive tenantId={ctx.tenantId} initialItems={items} allLabels={allLabels} />;
}
