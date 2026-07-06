import type { ChatMessage, ConversationListItem, WhatsAppGroupListItem } from "./types";

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
    cache: "no-store",
  });
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
  const res = await fetch(url, { cache: "no-store" });
  const payload = (await res.json()) as { conversations?: ConversationListItem[]; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "Falha ao carregar conversas");
  return payload.conversations ?? [];
}

export async function fetchWhatsAppGroupItems(tenantId: string): Promise<WhatsAppGroupListItem[]> {
  void tenantId;
  const res = await fetch("/api/chat/groups", { cache: "no-store" });
  const data = (await res.json()) as { groups?: WhatsAppGroupListItem[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Falha ao carregar grupos");
  return data.groups ?? [];
}
