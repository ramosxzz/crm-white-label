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
  /**
   * Os numeros vieram (tambem) de um numero atendido pela equipe toda.
   *
   * Muda o que a tela pode afirmar: num numero compartilhado nao da pra dizer
   * "voce enviou X". Quem atende pelo aparelho nao passa pelo CRM, entao a
   * mensagem chega sem autor - na Atacado Moda Sul, 9 das 9 saidas do dia
   * estavam sem `user_id`. O painel entao mostra o movimento do numero, dito
   * com essas palavras, em vez de creditar a uma pessoa so.
   */
  sharedNumber: boolean;
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
  // Entram os numeros dela E os da equipe. Sem os compartilhados, a loja que
  // atende com um numero so deixava toda vendedora com o painel zerado: nao ha
  // numero atribuido a ninguem nem lead atribuido a ninguem, entao nenhuma das
  // duas pontas contava nada.
  const { data: accounts, error: accountsError } = await supabase
    .from("whatsapp_accounts")
    .select("id, assigned_to, shared_with_all")
    .eq("tenant_id", tenantId)
    .or(`assigned_to.eq.${userId},shared_with_all.eq.true`);
  if (accountsError) throw new Error(accountsError.message);

  const rows = (accounts ?? []) as { id: string; assigned_to: string | null; shared_with_all: boolean | null }[];
  const accountIds = rows.map((account) => account.id);
  const hasAccounts = accountIds.length > 0;
  const sharedNumber = rows.some((account) => account.shared_with_all === true);

  // Loja que atende so pelo numero da equipe: o que ela enxerga e a operacao
  // inteira, entao a conta e a do tenant. Contar apenas pelo vinculo com a
  // conta deixaria de fora as conversas sem numero identificado - na Atacado
  // Moda Sul sao 70 de 238, com 6 das 9 mensagens do dia. Elas aparecem no chat
  // dela; ficar de fora do painel faria o numero brigar com a tela ao lado.
  //
  // Quando a vendedora tambem tem numero proprio, o caminho e o preciso (dela +
  // equipe), senao o painel dela engoliria o numero particular do colega.
  const ownAccountIds = rows.filter((account) => account.assigned_to === userId).map((a) => a.id);
  const teamWide = sharedNumber && ownAccountIds.length === 0;

  if (teamWide) {
    const [msgs, convos, clients, newLeads] = await Promise.all([
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("direction", "outbound")
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabase
        .from("conversations")
        .select("id, messages!inner(id)", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("messages.direction", "outbound")
        .gte("messages.created_at", startIso)
        .lte("messages.created_at", endIso),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", startIso)
        .lte("created_at", endIso),
    ]);

    return {
      messagesSentToday: readCount(msgs, "Mensagens da equipe"),
      conversationsToday: readCount(convos, "Conversas da equipe"),
      assignedLeads: readCount(clients, "Clientes no numero"),
      newAssignedToday: readCount(newLeads, "Leads novos de hoje"),
      sharedNumber: true,
    };
  }

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
    sharedNumber,
  };
}
