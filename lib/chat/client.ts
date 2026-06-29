import { createClient } from "@/lib/supabase/client";
import { buildConversationItems } from "@/lib/chat/build-conversation-items";
import type { ConversationLeadRow } from "@/lib/chat/conversation-filter";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import type { ChatMessage, ConversationListItem, WhatsAppGroupListItem } from "./types";

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, direction, created_at, status, media_url, media_type, user_id, profiles:user_id(full_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const profile = r.profiles as { full_name?: string | null } | null;
    return {
      id: r.id as string,
      body: r.body as string | null,
      direction: r.direction as "inbound" | "outbound",
      created_at: r.created_at as string,
      status: r.status as string,
      media_url: r.media_url as string | null,
      media_type: r.media_type as string | null,
      user_id: r.user_id as string | null,
      sender_name: profile?.full_name ?? null,
    };
  });
}

export async function fetchConversationItems(tenantId: string): Promise<ConversationListItem[]> {
  const supabase = createClient();

  const [{ data: conversations, error }, { data: waAccount }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, lead_id, last_message_at, unread_count, status, leads(name, phone, whatsapp_lid)")
      .eq("tenant_id", tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);

  const rows = (conversations ?? []) as unknown as ConversationLeadRow[];
  const convIds = rows.map((c) => c.id);

  let messagePreviews: { conversation_id: string; body: string | null; direction: string }[] = [];
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, body, direction, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(500);
    messagePreviews = msgs ?? [];
  }

  return buildConversationItems(rows, messagePreviews, (waAccount as WhatsAppAccount | null) ?? null);
}

export async function fetchWhatsAppGroupItems(tenantId: string): Promise<WhatsAppGroupListItem[]> {
  void tenantId;
  const res = await fetch("/api/chat/groups", { cache: "no-store" });
  const data = (await res.json()) as { groups?: WhatsAppGroupListItem[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Falha ao carregar grupos");
  return data.groups ?? [];
}
