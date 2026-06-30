import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { putR2Object } from "@/lib/storage/r2";

type PersistInput = {
  tenantId: string;
  conversationId: string;
  messageId?: string | null;
  externalId?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaBase64?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
};

type PersistedMedia = {
  mediaUrl: string | null;
  mediaType: string | null;
};

type EvolutionCredentials = {
  base_url?: string;
  api_key?: string;
  instance?: string;
};

const BUCKET = "chat-media";

function cleanBase64(value: string) {
  const trimmed = value.trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) return trimmed.slice(comma + 1);
  return trimmed;
}

function extensionFor(contentType: string, mediaType?: string | null) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("ogg") || contentType.includes("opus")) return "ogg";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("json")) return "json";
  if (mediaType?.startsWith("image")) return "jpg";
  if (mediaType?.startsWith("video")) return "mp4";
  if (mediaType?.startsWith("audio")) return "ogg";
  if (mediaType === "document") return "bin";
  return "bin";
}

export function defaultContentType(mediaType?: string | null) {
  const type = mediaType?.toLowerCase() ?? "";
  if (type.includes("/")) return type;
  if (type.startsWith("image")) return "image/jpeg";
  if (type.startsWith("video")) return "video/mp4";
  if (type.startsWith("audio")) return "audio/ogg";
  if (type === "sticker") return "image/webp";
  return "application/octet-stream";
}

export function isWhatsAppEncryptedMediaUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("whatsapp.net") && (parsed.pathname.endsWith(".enc") || parsed.hostname === "mmg.whatsapp.net");
  } catch {
    return false;
  }
}

function findBase64Payload(value: unknown, depth = 0): { base64: string; mimetype?: string; fileName?: string } | null {
  if (!value || depth > 4) return null;
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const direct = typeof record.base64 === "string" ? record.base64 : null;
  if (direct && direct.trim().length > 32) {
    return {
      base64: direct,
      mimetype: typeof record.mimetype === "string" ? record.mimetype : undefined,
      fileName: typeof record.fileName === "string" ? record.fileName : undefined,
    };
  }
  for (const child of Object.values(record)) {
    const found = findBase64Payload(child, depth + 1);
    if (found) return found;
  }
  return null;
}

export async function fetchEvolutionMediaBase64(
  account: WhatsAppAccount,
  externalId: string,
  mediaType?: string | null,
) {
  const creds = account.credentials as EvolutionCredentials;
  const baseUrl = creds.base_url?.replace(/\/$/, "");
  const apiKey = creds.api_key;
  const instance = creds.instance;
  if (!baseUrl || !apiKey || !instance || !externalId) return null;

  const res = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: { key: { id: externalId } },
      convertToMp4: mediaType?.startsWith("audio") ? false : undefined,
    }),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const raw = await res.json().catch(() => null);
  return findBase64Payload(raw);
}

export async function persistWhatsAppMedia(
  supabase: any,
  account: WhatsAppAccount | null,
  input: PersistInput,
): Promise<PersistedMedia> {
  const originalUrl = input.mediaUrl?.trim() || null;
  if (!input.mediaType && !originalUrl && !input.mediaBase64) {
    return { mediaUrl: null, mediaType: null };
  }

  let base64 = input.mediaBase64?.trim() || null;
  let contentType = input.mediaMimeType?.trim() || defaultContentType(input.mediaType);
  let fileName = input.mediaFileName?.trim() || null;

  if (!base64 && account?.provider === "evolution" && input.externalId && isWhatsAppEncryptedMediaUrl(originalUrl)) {
    const fetched = await fetchEvolutionMediaBase64(account, input.externalId, input.mediaType);
    base64 = fetched?.base64 ?? null;
    contentType = fetched?.mimetype ?? contentType;
    fileName = fetched?.fileName ?? fileName;
  }

  if (!base64) {
    return { mediaUrl: originalUrl, mediaType: input.mediaMimeType || input.mediaType || null };
  }

  const bytes = Buffer.from(cleanBase64(base64), "base64");
  if (!bytes.byteLength) {
    return { mediaUrl: originalUrl, mediaType: input.mediaMimeType || input.mediaType || null };
  }

  const key = input.messageId || input.externalId || `${Date.now()}`;
  const ext = fileName?.split(".").pop() || extensionFor(contentType, input.mediaType);
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `${input.tenantId}/${input.conversationId}/${safeKey}.${ext}`;
  const r2Url = await putR2Object({
    key: path,
    body: bytes,
    contentType,
  }).catch((error) => {
    console.error("[whatsapp-media] upload R2 falhou", error);
    return null;
  });

  if (r2Url) {
    return { mediaUrl: r2Url, mediaType: contentType || input.mediaType || null };
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    cacheControl: "31536000",
    contentType,
    upsert: true,
  });

  if (error) {
    console.error("[whatsapp-media] upload falhou", error.message);
    return { mediaUrl: originalUrl, mediaType: input.mediaMimeType || input.mediaType || null };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { mediaUrl: data.publicUrl, mediaType: contentType || input.mediaType || null };
}
