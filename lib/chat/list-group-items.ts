import { buildWhatsAppGroupItems } from "@/lib/chat/group-items";
import type { WhatsAppGroupListItem } from "@/lib/chat/types";
import {
  canAccessConversationAccount,
  type ChatAccountVisibility,
} from "@/lib/chat/list-conversation-items";
import { createServiceClient } from "@/lib/supabase/server";

export async function listWhatsAppGroupItemsForTenant(
  tenantId: string,
  visibility: ChatAccountVisibility | null,
  limit = 200,
): Promise<WhatsAppGroupListItem[]> {
  const supabase = createServiceClient();
  const { data: groups, error } = await supabase
    .from("whatsapp_groups")
    .select(
      "id, whatsapp_account_id, provider_group_id, subject, description, participant_count, last_event_type, last_event_at, updated_at, last_message_body, last_message_direction, last_message_at, unread_count",
    )
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) throw new Error(error.message);

  const visibleGroups = (groups ?? []).filter((group) =>
    canAccessConversationAccount(group.whatsapp_account_id, visibility),
  );
  if (visibleGroups.length === 0) return [];

  const groupIds = visibleGroups.map((group) => group.id);
  const groupJids = visibleGroups.map((group) => group.provider_group_id);
  const [assignmentsResult, logsResult] = await Promise.all([
    supabase
      .from("whatsapp_group_label_assignments")
      .select("group_id, whatsapp_group_labels(id, name, color)")
      .eq("tenant_id", tenantId)
      .in("group_id", groupIds),
    supabase
      .from("whatsapp_webhook_logs")
      .select("contact_lid, from_me, payload, created_at")
      .eq("tenant_id", tenantId)
      .eq("event_type", "GROUP_MESSAGE")
      .in("contact_lid", groupJids)
      .order("created_at", { ascending: false })
      .limit(Math.min(groupJids.length * 5, 1_000)),
  ]);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  return buildWhatsAppGroupItems(
    visibleGroups,
    (assignmentsResult.data ?? []) as Parameters<typeof buildWhatsAppGroupItems>[1],
    (logsResult.data ?? []) as Parameters<typeof buildWhatsAppGroupItems>[2],
  );
}
