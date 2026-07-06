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

export type ConversationListFilters = {
  search?: string | null;
  status?: string | null;
};

export async function listConversationItemsForTenant(
  tenantId: string,
  limit = 100,
  filters: ConversationListFilters = {},
  tenantName?: string | null,
): Promise<ConversationListItem[]> {
  const supabase = createServiceClient();
  const rpcClient = supabase as unknown as ChatConversationRpcClient;
  const search = filters.search?.trim() ?? "";
  const status = filters.status?.trim() ?? "";
  const hasFilters = Boolean(search || (status && status !== "todas"));

  if (hasFilters) {
    return listFilteredConversationItemsForTenant(tenantId, limit, { search, status }, tenantName);
  }

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
    { tenantName },
  );
}

async function listFilteredConversationItemsForTenant(
  tenantId: string,
  limit: number,
  filters: { search: string; status: string },
  tenantName?: string | null,
): Promise<ConversationListItem[]> {
  const supabase = createServiceClient();
  const cappedLimit = Math.min(Math.max(limit, 1), 300);
  const search = filters.search.trim();
  const status = filters.status.trim();
  let leadIds: string[] | null = null;

  if (search) {
    const matches = await findMatchingLeadIds(tenantId, search);
    leadIds = [...new Set(matches)];
    if (leadIds.length === 0) return [];
  }

  let query = supabase
    .from("conversations")
    .select("id, lead_id, channel, last_message_at, unread_count, status, leads!inner(name, phone, whatsapp_lid, custom_fields)")
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(cappedLimit);

  if (status && status !== "todas") query = query.eq("status", status);
  if (leadIds) query = query.in("lead_id", leadIds);

  const [{ data: rows, error }, { data: waAccount }] = await Promise.all([
    query,
    supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);

  const conversationRows = ((rows ?? []) as unknown as ConversationLeadRow[]).map((row) => ({
    ...row,
    status: row.status as ConversationLeadRow["status"],
  }));
  const conversationIds = conversationRows.map((row) => row.id);
  const messagePreviews = await fetchLatestMessagePreviews(tenantId, conversationIds);

  return buildConversationItems(
    conversationRows,
    messagePreviews,
    (waAccount as WhatsAppAccount | null) ?? null,
    { tenantName },
  );
}

async function findMatchingLeadIds(tenantId: string, search: string): Promise<string[]> {
  const supabase = createServiceClient();
  const terms = buildLeadSearchTerms(search);
  const queries = [
    supabase
      .from("leads")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${search}%`)
      .limit(250),
    ...terms.map((term) =>
      supabase
        .from("leads")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("phone", `%${term}%`)
        .limit(250),
    ),
  ];
  const results = await Promise.all(queries);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  return results.flatMap((result) =>
    ((result.data ?? []) as { id: string }[]).map((row) => row.id),
  );
}

function buildLeadSearchTerms(search: string): string[] {
  const digits = search.replace(/\D/g, "");
  const terms = new Set<string>();
  if (search) terms.add(search);
  if (digits.length >= 4) {
    terms.add(digits);
    terms.add(digits.slice(-9));
    terms.add(digits.slice(-8));
  }
  return [...terms].filter(Boolean);
}

async function fetchLatestMessagePreviews(
  tenantId: string,
  conversationIds: string[],
): Promise<{ conversation_id: string; body: string | null; direction: string }[]> {
  if (conversationIds.length === 0) return [];
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, body, direction, created_at")
    .eq("tenant_id", tenantId)
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(conversationIds.length * 5);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const previews: { conversation_id: string; body: string | null; direction: string }[] = [];
  for (const row of (data ?? []) as {
    conversation_id: string;
    body: string | null;
    direction: string | null;
  }[]) {
    if (seen.has(row.conversation_id)) continue;
    seen.add(row.conversation_id);
    previews.push({
      conversation_id: row.conversation_id,
      body: row.body,
      direction: row.direction ?? "inbound",
    });
  }
  return previews;
}
