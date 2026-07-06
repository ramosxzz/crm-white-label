import type { ChatMessage, ConversationListItem, WhatsAppGroupListItem } from "./types";

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
    cache: "no-store",
  });
  const payload = (await res.json()) as { messages?: ChatMessage[]; error?: string };
  if (!res.ok) throw new Error(payload.error ?? "Falha ao carregar mensagens");
  return payload.messages ?? [];
}

export async function fetchConversationItems(tenantId: string): Promise<ConversationListItem[]> {
  void tenantId;
  const res = await fetch("/api/chat/conversations", { cache: "no-store" });
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
