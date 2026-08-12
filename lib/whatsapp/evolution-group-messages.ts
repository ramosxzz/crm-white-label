export type EvolutionGroupMessage = {
  external_id: string;
  provider_group_id: string;
  sender_jid: string | null;
  sender_name: string | null;
  direction: "inbound" | "outbound";
  body: string;
  media_url: string | null;
  media_type: string | null;
  media_base64: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  message_at: string;
  raw_payload: Record<string, unknown>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function mediaDetails(message: Record<string, unknown> | null) {
  if (!message) return null;
  const candidates = [
    ["image", record(message.imageMessage)],
    ["video", record(message.videoMessage)],
    ["audio", record(message.audioMessage)],
    ["document", record(message.documentMessage)],
    ["image", record(message.stickerMessage)],
  ] as const;
  for (const [kind, data] of candidates) {
    if (!data) continue;
    return {
      media_url: text(data.url),
      media_type: text(data.mimetype) ?? kind,
      media_base64: text(data.base64),
      media_mime_type: text(data.mimetype),
      media_file_name: text(data.fileName) ?? text(data.title),
    };
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function messageText(message: Record<string, unknown> | null): string | null {
  if (!message) return null;
  const extended = record(message.extendedTextMessage);
  const image = record(message.imageMessage);
  const video = record(message.videoMessage);
  const audio = record(message.audioMessage);
  return (
    text(message.conversation) ??
    text(extended?.text) ??
    text(image?.caption) ??
    text(video?.caption) ??
    (audio ? "Audio" : null)
  );
}

function messageDate(value: unknown): string {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    return new Date(millis).toISOString();
  }
  return new Date().toISOString();
}

export function parseEvolutionGroupMessages(payload: unknown): EvolutionGroupMessage[] {
  const root = record(payload);
  if (!root) return [];
  const event = text(root.event)?.toUpperCase().replace(/[.\-]/g, "_");
  if (event !== "MESSAGES_UPSERT") return [];

  const dataRows = Array.isArray(root.data) ? root.data : [root.data];
  return dataRows.flatMap((row) => {
    const data = record(row);
    if (!data) return [];
    const key = record(data.key);
    const remoteJid = text(key?.remoteJid);
    if (!remoteJid?.includes("@g.us")) return [];

    const message = record(data.message);
    const media = mediaDetails(message);
    const body = messageText(message) ?? (media?.media_file_name ? `Documento: ${media.media_file_name}` : media ? "Midia" : null);
    if (!body) return [];

    return [
      {
        external_id: text(key?.id) ?? `${remoteJid}-${text(data.messageTimestamp) ?? Date.now()}`,
        provider_group_id: remoteJid,
        sender_jid: text(key?.participant) ?? text(data.participant),
        sender_name: text(data.pushName),
        direction: key?.fromMe === true ? "outbound" : "inbound",
        body,
        media_url: media?.media_url ?? null,
        media_type: media?.media_type ?? null,
        media_base64: media?.media_base64 ?? text(data.base64),
        media_mime_type: media?.media_mime_type ?? null,
        media_file_name: media?.media_file_name ?? null,
        message_at: messageDate(data.messageTimestamp),
        raw_payload: data,
      },
    ];
  });
}
