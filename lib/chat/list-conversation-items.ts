import { buildConversationItems } from "@/lib/chat/build-conversation-items";
import type { ConversationLeadRow } from "@/lib/chat/conversation-filter";
import type { ConversationListItem } from "@/lib/chat/types";
import { createServiceClient } from "@/lib/supabase/server";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";

type ChatConversationRow = {
  id: string;
  lead_id: string;
  channel: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  status: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_whatsapp_lid: string | null;
  lead_custom_fields: Record<string, unknown> | null;
  last_body: string | null;
  last_direction: string | null;
};

type ChatConversationRpcClient = {
  rpc(
    fn: "list_chat_conversations",
    args: { p_tenant_id: string; p_limit: number },
  ): Promise<{ data: ChatConversationRow[] | null; error: { message: string } | null }>;
};

export async function listConversationItemsForTenant(
  tenantId: string,
  limit = 100,
): Promise<ConversationListItem[]> {
  const supabase = createServiceClient();
  const rpcClient = supabase as unknown as ChatConversationRpcClient;

  const [{ data: rows, error }, { data: waAccount }] = await Promise.all([
    rpcClient.rpc("list_chat_conversations", {
      p_tenant_id: tenantId,
      p_limit: limit,
    }),
    supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);

  const conversationRows = ((rows ?? []) as ChatConversationRow[]).map(
    (row): ConversationLeadRow => ({
      id: row.id,
      lead_id: row.lead_id,
      channel: row.channel,
      last_message_at: row.last_message_at,
      unread_count: row.unread_count,
      status: row.status as ConversationLeadRow["status"],
      leads: {
        name: row.lead_name,
        phone: row.lead_phone,
        whatsapp_lid: row.lead_whatsapp_lid,
        custom_fields: row.lead_custom_fields,
      },
    }),
  );

  const messagePreviews = ((rows ?? []) as ChatConversationRow[])
    .filter((row) => row.last_body || row.last_direction)
    .map((row) => ({
      conversation_id: row.id,
      body: row.last_body,
      direction: row.last_direction ?? "inbound",
    }));

  return buildConversationItems(
    conversationRows,
    messagePreviews,
    (waAccount as WhatsAppAccount | null) ?? null,
  );
}
