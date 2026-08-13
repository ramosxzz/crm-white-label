import { buildConversationItems } from "@/lib/chat/build-conversation-items";
import type { ConversationLeadRow } from "@/lib/chat/conversation-filter";
import type { ConversationListItem } from "@/lib/chat/types";
import { createServiceClient } from "@/lib/supabase/server";
import type { ConversationStatus, WhatsAppAccount } from "@/lib/supabase/database.types";
import { canSeeAllLeads } from "@/lib/auth/roles";
import type { MemberRole } from "@/lib/supabase/database.types";

export type ChatAccountVisibility = {
  blockedAccountIds: string[];
  allowUnlinkedConversations: boolean;
};

type AccountVisibilityRow = {
  id: string;
  assigned_to: string | null;
  shared_with_all?: boolean | null;
};

/**
 * Quem enxerga quais conversas.
 *
 * Gestao ve tudo. Vendedor ve os numeros dele mais os marcados como da equipe.
 * Atendente preserva o modo compartilhado dos tenants sem numero individual
 * (so fica restrito se ele mesmo tiver um numero proprio).
 *
 * A separacao por numero e uma configuracao independente do "distribuir
 * leads" do Kanban (`tenants.lead_assignment_enabled`) - sao features
 * diferentes (uma e por numero de WhatsApp, a outra e por lead) e um tenant
 * pode querer so uma delas. Ja existiu aqui um atalho que desligava esta
 * restricao inteira quando `lead_assignment_enabled` estava off - quebrou a
 * Vasos Fortuna, que usa numero por vendedor mas nao usa distribuicao de
 * leads: o Kanban liberava geral (certo) mas o chat tambem liberava geral
 * (errado - vendedor lia numero de colega e do admin). Removido; quem decide
 * a restricao aqui e so o papel do usuario e o `assigned_to` de cada numero.
 *
 * Cuidado que ja custou acesso de cliente: "sem responsavel" nao pode virar
 * "de ninguem" pro vendedor. Com um unico numero da loja e nenhum dono, a
 * regra antiga zerava a lista e o vendedor abria o chat vazio (aconteceu na
 * Atacado Moda Sul). Numero da equipe agora e escolha explicita -
 * `shared_with_all` -, nao deducao a partir do nulo.
 */
export function buildChatAccountVisibility(
  accounts: AccountVisibilityRow[],
  userId: string,
  role: MemberRole,
): ChatAccountVisibility | null {
  if (canSeeAllLeads(role)) return null;

  const isShared = (account: AccountVisibilityRow) => account.shared_with_all === true;
  const ownedIds = accounts
    .filter((account) => account.assigned_to === userId)
    .map((account) => account.id);
  const sharedIds = accounts.filter(isShared).map((account) => account.id);

  const mustUseOwnNumbers = role === "vendedor" || ownedIds.length > 0;
  const allowedIds = new Set(
    mustUseOwnNumbers
      ? [...ownedIds, ...sharedIds]
      : accounts
          .filter((account) => account.assigned_to === null || isShared(account))
          .map((account) => account.id),
  );

  // Conversa sem conta identificada (importada, ou de antes do vinculo) segue
  // visivel quando nao ha separacao por numero, ou quando existe numero da
  // equipe - senao ela sumiria justamente pra quem atende no numero da loja.
  const allowUnlinkedConversations = !mustUseOwnNumbers || sharedIds.length > 0;

  return {
    blockedAccountIds: accounts
      .filter((account) => !allowedIds.has(account.id))
      .map((account) => account.id),
    allowUnlinkedConversations,
  };
}

export async function getChatAccountVisibility(
  tenantId: string,
  userId: string,
  role: MemberRole,
): Promise<ChatAccountVisibility | null> {
  if (canSeeAllLeads(role)) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("whatsapp_accounts")
    .select("id, assigned_to, shared_with_all")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  return buildChatAccountVisibility((data ?? []) as AccountVisibilityRow[], userId, role);
}

export function canAccessConversationAccount(
  whatsappAccountId: string | null,
  visibility: ChatAccountVisibility | null,
): boolean {
  if (!visibility) return true;
  if (!whatsappAccountId) return visibility.allowUnlinkedConversations;
  return !visibility.blockedAccountIds.includes(whatsappAccountId);
}

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
  whatsapp_account_id: string | null;
  lead_tags: string[] | null;
  lead_stage_id: string | null;
  lead_quality_stars: number | null;
  lead_created_at: string | null;
};

type ChatConversationRpcClient = {
  rpc(
    fn: "list_chat_conversations",
    args: {
      p_tenant_id: string;
      p_limit: number;
      p_search: string | null;
      p_status: string | null;
    },
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
  visibility?: ChatAccountVisibility | null,
): Promise<ConversationListItem[]> {
  const supabase = createServiceClient();
  const rpcClient = supabase as unknown as ChatConversationRpcClient;
  const search = filters.search?.trim() ?? "";
  const status = filters.status?.trim() ?? "";
  const hasFilters = Boolean(search || (status && status !== "todas"));

  if (hasFilters) {
    return listFilteredConversationItemsForTenant(tenantId, limit, { search, status }, tenantName, visibility);
  }

  const [{ data: rows, error }, { data: waAccount }] = await Promise.all([
    rpcClient.rpc("list_chat_conversations", {
      p_tenant_id: tenantId,
      p_limit: limit,
      p_search: null,
      p_status: null,
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
      whatsapp_account_id: row.whatsapp_account_id,
      leads: {
        name: row.lead_name,
        phone: row.lead_phone,
        whatsapp_lid: row.lead_whatsapp_lid,
        custom_fields: row.lead_custom_fields,
        tags: row.lead_tags,
        stage_id: row.lead_stage_id,
        quality_stars: row.lead_quality_stars,
        created_at: row.lead_created_at,
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

  const items = buildConversationItems(
    conversationRows,
    messagePreviews,
    (waAccount as WhatsAppAccount | null) ?? null,
    { tenantName },
  );
  return filterByAllowedAccounts(items, visibility);
}

export function filterByAllowedAccounts(
  items: ConversationListItem[],
  visibility?: ChatAccountVisibility | null,
): ConversationListItem[] {
  if (!visibility) return items;
  return items.filter((item) =>
    canAccessConversationAccount(item.whatsappAccountId, visibility),
  );
}

async function listFilteredConversationItemsForTenant(
  tenantId: string,
  limit: number,
  filters: { search: string; status: string },
  tenantName?: string | null,
  visibility?: ChatAccountVisibility | null,
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
    .select("id, lead_id, channel, whatsapp_account_id, last_message_at, unread_count, status, leads!inner(name, phone, whatsapp_lid, custom_fields, tags, stage_id, created_at, quality_stars)")
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(cappedLimit);

  // O filtro vem da UI, sempre um dos valores do select - "todas" ja foi
  // descartado acima, entao o resto e garantidamente um status valido.
  if (status && status !== "todas") query = query.eq("status", status as ConversationStatus);
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

  const items = buildConversationItems(
    conversationRows,
    messagePreviews,
    (waAccount as WhatsAppAccount | null) ?? null,
    { tenantName },
  );
  return filterByAllowedAccounts(items, visibility);
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
