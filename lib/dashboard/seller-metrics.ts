import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

export type SellerDashboardMetrics = {
  messagesSentToday: number;
  conversationsToday: number;
  assignedLeads: number;
  newAssignedToday: number;
};

export function combineScopedCounts(
  directCount: number,
  accountCount: number,
  overlapCount: number,
): number {
  return Math.max(0, directCount + accountCount - overlapCount);
}

function readCount(result: CountResult, label: string): number {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.count ?? 0;
}

function emptyCount(): Promise<CountResult> {
  return Promise.resolve({ count: 0, error: null });
}

export async function getSellerDashboardMetrics(
  supabase: SupabaseClient<Database>,
  input: {
    tenantId: string;
    userId: string;
    startIso: string;
    endIso: string;
  },
): Promise<SellerDashboardMetrics> {
  const { tenantId, userId, startIso, endIso } = input;
  const { data: accounts, error: accountsError } = await supabase
    .from("whatsapp_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("assigned_to", userId);
  if (accountsError) throw new Error(accountsError.message);

  const accountIds = (accounts ?? []).map((account) => account.id);
  const hasAccounts = accountIds.length > 0;

  const directMessages = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("direction", "outbound")
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lte("created_at", endIso);
  const accountMessages = hasAccounts
    ? supabase
        .from("messages")
        .select("id, conversations!inner(whatsapp_account_id)", {
          count: "exact",
          head: true,
        })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .in("conversations.whatsapp_account_id", accountIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
    : emptyCount();
  const overlappingMessages = hasAccounts
    ? supabase
        .from("messages")
        .select("id, conversations!inner(whatsapp_account_id)", {
          count: "exact",
          head: true,
        })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .eq("user_id", userId)
        .in("conversations.whatsapp_account_id", accountIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
    : emptyCount();

  const directConversations = supabase
    .from("conversations")
    .select("id, messages!inner(id)", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("messages.direction", "outbound")
    .eq("messages.user_id", userId)
    .gte("messages.created_at", startIso)
    .lte("messages.created_at", endIso);
  const accountConversations = hasAccounts
    ? supabase
        .from("conversations")
        .select("id, messages!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("whatsapp_account_id", accountIds)
        .eq("messages.direction", "outbound")
        .gte("messages.created_at", startIso)
        .lte("messages.created_at", endIso)
    : emptyCount();
  const overlappingConversations = hasAccounts
    ? supabase
        .from("conversations")
        .select("id, messages!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("whatsapp_account_id", accountIds)
        .eq("messages.direction", "outbound")
        .eq("messages.user_id", userId)
        .gte("messages.created_at", startIso)
        .lte("messages.created_at", endIso)
    : emptyCount();

  const directlyAssignedLeads = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("assigned_to", userId);
  const accountLeads = hasAccounts
    ? supabase
        .from("conversations")
        .select("id, leads!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("whatsapp_account_id", accountIds)
    : emptyCount();
  const overlappingLeads = hasAccounts
    ? supabase
        .from("conversations")
        .select("id, leads!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("whatsapp_account_id", accountIds)
        .eq("leads.assigned_to", userId)
    : emptyCount();

  const directlyAssignedToday = supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("assigned_to", userId)
    .gte("created_at", startIso)
    .lte("created_at", endIso);
  const accountLeadsToday = hasAccounts
    ? supabase
        .from("conversations")
        .select("id, leads!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("whatsapp_account_id", accountIds)
        .gte("leads.created_at", startIso)
        .lte("leads.created_at", endIso)
    : emptyCount();
  const overlappingLeadsToday = hasAccounts
    ? supabase
        .from("conversations")
        .select("id, leads!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("whatsapp_account_id", accountIds)
        .eq("leads.assigned_to", userId)
        .gte("leads.created_at", startIso)
        .lte("leads.created_at", endIso)
    : emptyCount();

  const [
    directMessagesResult,
    accountMessagesResult,
    overlappingMessagesResult,
    directConversationsResult,
    accountConversationsResult,
    overlappingConversationsResult,
    directlyAssignedLeadsResult,
    accountLeadsResult,
    overlappingLeadsResult,
    directlyAssignedTodayResult,
    accountLeadsTodayResult,
    overlappingLeadsTodayResult,
  ] = await Promise.all([
    directMessages,
    accountMessages,
    overlappingMessages,
    directConversations,
    accountConversations,
    overlappingConversations,
    directlyAssignedLeads,
    accountLeads,
    overlappingLeads,
    directlyAssignedToday,
    accountLeadsToday,
    overlappingLeadsToday,
  ]);

  return {
    messagesSentToday: combineScopedCounts(
      readCount(directMessagesResult, "Mensagens diretas"),
      readCount(accountMessagesResult, "Mensagens do numero"),
      readCount(overlappingMessagesResult, "Mensagens em comum"),
    ),
    conversationsToday: combineScopedCounts(
      readCount(directConversationsResult, "Conversas diretas"),
      readCount(accountConversationsResult, "Conversas do numero"),
      readCount(overlappingConversationsResult, "Conversas em comum"),
    ),
    assignedLeads: combineScopedCounts(
      readCount(directlyAssignedLeadsResult, "Leads diretos"),
      readCount(accountLeadsResult, "Leads do numero"),
      readCount(overlappingLeadsResult, "Leads em comum"),
    ),
    newAssignedToday: combineScopedCounts(
      readCount(directlyAssignedTodayResult, "Leads diretos de hoje"),
      readCount(accountLeadsTodayResult, "Leads do numero de hoje"),
      readCount(overlappingLeadsTodayResult, "Leads de hoje em comum"),
    ),
  };
}
