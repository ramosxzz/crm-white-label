import type { ConversationListItem } from "./types";

export type RealtimeConversationMessage = {
  conversation_id?: string | null;
  direction?: "inbound" | "outbound" | null;
  body?: string | null;
  media_type?: string | null;
  created_at?: string | null;
};

function mediaPreview(mediaType: string | null | undefined): string {
  const type = mediaType?.toLowerCase() ?? "";
  if (type.startsWith("image")) return "📷 Imagem";
  if (type.startsWith("audio")) return "🎤 Áudio";
  if (type.startsWith("video")) return "🎬 Vídeo";
  if (type === "document" || type.startsWith("application")) return "📎 Documento";
  return "Mensagem";
}

/**
 * Reflete o INSERT do Realtime na lista sem esperar uma nova consulta HTTP.
 * A consulta continua existindo como reconciliação autoritativa.
 */
export function applyRealtimeMessageToConversationItems(
  items: ConversationListItem[],
  row: RealtimeConversationMessage,
): { items: ConversationListItem[]; matched: boolean } {
  if (!row.conversation_id) return { items, matched: false };

  const index = items.findIndex((item) => item.id === row.conversation_id);
  if (index < 0) return { items, matched: false };

  const current = items[index];
  const body = row.body?.trim();
  const updated: ConversationListItem = {
    ...current,
    lastAt: row.created_at ?? current.lastAt,
    lastPreview: body || mediaPreview(row.media_type),
    lastDirection: row.direction ?? current.lastDirection,
    unread:
      row.direction === "inbound"
        ? current.unread + 1
        : row.direction === "outbound"
          ? 0
          : current.unread,
  };

  const next = items.slice();
  next[index] = updated;
  return { items: next, matched: true };
}
