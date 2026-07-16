import type { ChatMessage, ConversationListItem, WhatsAppGroupListItem } from "./types";

const noStoreFetchOptions: RequestInit = {
  cache: "no-store",
  headers: {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  },
};

function withFreshParam(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}_=${Date.now()}`;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await fetch(
    withFreshParam(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`),
    noStoreFetchOptions,
  );
  const payload = (await res.json()) as { messages?: ChatMessage[]; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "Falha ao carregar mensagens");
  return payload.messages ?? [];
}

export async function fetchConversationItems(
  tenantId: string,
  options: { query?: string; status?: string } = {},
): Promise<ConversationListItem[]> {
  void tenantId;
  const params = new URLSearchParams();
  if (options.query?.trim()) params.set("q", options.query.trim());
  if (options.status?.trim()) params.set("status", options.status.trim());
  const url = params.size > 0 ? `/api/chat/conversations?${params.toString()}` : "/api/chat/conversations";
  const res = await fetch(withFreshParam(url), noStoreFetchOptions);
  const payload = (await res.json()) as { conversations?: ConversationListItem[]; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "Falha ao carregar conversas");
  return payload.conversations ?? [];
}

export async function fetchWhatsAppGroupItems(tenantId: string): Promise<WhatsAppGroupListItem[]> {
  void tenantId;
  const res = await fetch(withFreshParam("/api/chat/groups"), noStoreFetchOptions);
  const data = (await res.json()) as { groups?: WhatsAppGroupListItem[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Falha ao carregar grupos");
  return data.groups ?? [];
}
