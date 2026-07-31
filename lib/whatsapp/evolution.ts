import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { normalizeWhatsAppPhone } from "./phone";
import {
  fetchWithTimeout,
  PROVIDER_TIMEOUT_MEDIA_MS,
  PROVIDER_TIMEOUT_TEXT_MS,
} from "./fetch-with-timeout";
import type {
  DeleteMessageInput,
  EditMessageInput,
  InboundNormalized,
  SendMediaInput,
  SendMessageInput,
  SendMessageResult,
  SendTemplateInput,
  WhatsAppProvider,
} from "./provider";

interface EvolutionCredentials {
  base_url: string;
  api_key: string;
  instance: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return undefined;
}

function pickExternalAdReply(messageObj: any) {
  const candidates = [
    messageObj?.referral,
    messageObj?.externalAdReply,
    messageObj?.contextInfo?.externalAdReply,
    messageObj?.messageContextInfo?.externalAdReply,
    messageObj?.extendedTextMessage?.contextInfo?.externalAdReply,
    messageObj?.imageMessage?.contextInfo?.externalAdReply,
    messageObj?.videoMessage?.contextInfo?.externalAdReply,
    messageObj?.documentMessage?.contextInfo?.externalAdReply,
    messageObj?.audioMessage?.contextInfo?.externalAdReply,
    messageObj?.stickerMessage?.contextInfo?.externalAdReply,
    messageObj?.buttonsResponseMessage?.contextInfo?.externalAdReply,
    messageObj?.templateButtonReplyMessage?.contextInfo?.externalAdReply,
    messageObj?.listResponseMessage?.contextInfo?.externalAdReply,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === "object") ?? null;
}

function normalizeReferral(messageObj: any) {
  const rawReferral = pickExternalAdReply(messageObj);
  const sourceId = firstText(
    rawReferral?.sourceId,
    rawReferral?.source_id,
    rawReferral?.sourceID,
    rawReferral?.adId,
    rawReferral?.ad_id,
    rawReferral?.ctwaAdId,
    rawReferral?.ctwa_ad_id,
  );

  if (!sourceId) return null;

  return {
    sourceId,
    sourceType: firstText(rawReferral?.sourceType, rawReferral?.source_type, rawReferral?.sourceTypeV2) ?? "ad",
    sourceUrl: firstText(rawReferral?.sourceUrl, rawReferral?.source_url, rawReferral?.thumbnailUrl),
    headline: firstText(rawReferral?.headline, rawReferral?.title),
    body: firstText(rawReferral?.body, rawReferral?.description),
    mediaType: firstText(rawReferral?.mediaType, rawReferral?.media_type),
    imageUrl: firstText(rawReferral?.imageUrl, rawReferral?.image_url, rawReferral?.thumbnailUrl, rawReferral?.jpegThumbnail),
    videoUrl: firstText(rawReferral?.videoUrl, rawReferral?.video_url),
  };
}

export class EvolutionProvider implements WhatsAppProvider {
  readonly kind = "evolution" as const;
  constructor(private account: WhatsAppAccount) {}

  private get creds(): EvolutionCredentials {
    return this.account.credentials as unknown as EvolutionCredentials;
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const url = `${this.creds.base_url.replace(/\/$/, "")}/message/sendText/${this.creds.instance}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({
          number: input.to.replace(/\D/g, ""),
          text: input.body ?? "",
          ...(input.quotedMessageId
            ? {
                quoted: {
                  key: {
                    id: input.quotedMessageId,
                  },
                },
              }
            : {}),
        }),
      },
      PROVIDER_TIMEOUT_TEXT_MS,
      "Evolution",
    );
    const data = (await res.json()) as { key?: { id?: string } };
    if (!res.ok) return { externalId: "", status: "failed", raw: data };
    return { externalId: data.key?.id ?? "", status: "sent", raw: data };
  }

  async editMessage(input: EditMessageInput): Promise<void> {
    const number = normalizeWhatsAppPhone(input.to);
    if (!number) throw new Error("Evolution: telefone invalido para editar a mensagem");

    const remoteJid = `${number}@s.whatsapp.net`;
    const url = `${this.creds.base_url.replace(/\/$/, "")}/chat/updateMessage/${encodeURIComponent(this.creds.instance)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({
          number,
          text: input.body,
          key: { id: input.externalId, remoteJid, fromMe: true },
        }),
      },
      PROVIDER_TIMEOUT_TEXT_MS,
      "Evolution",
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Evolution: falha ao editar mensagem (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
  }

  async deleteMessage(input: DeleteMessageInput): Promise<void> {
    const number = normalizeWhatsAppPhone(input.to);
    if (!number) throw new Error("Evolution: telefone invalido para apagar a mensagem");

    const url = `${this.creds.base_url.replace(/\/$/, "")}/chat/deleteMessageForEveryone/${encodeURIComponent(this.creds.instance)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "DELETE",
        headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({
          id: input.externalId,
          fromMe: input.fromMe,
          remoteJid: `${number}@s.whatsapp.net`,
        }),
      },
      PROVIDER_TIMEOUT_TEXT_MS,
      "Evolution",
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Evolution: falha ao apagar mensagem (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
  }

  async getConnectionStatus(): Promise<{ connected: boolean; state?: string; error?: string }> {
    const base = this.creds.base_url.replace(/\/$/, "");
    const url = `${base}/instance/connectionState/${encodeURIComponent(this.creds.instance)}`;
    const res = await fetch(url, {
      headers: { apikey: this.creds.api_key },
    });
    const data = (await res.json().catch(() => null)) as
      | { instance?: { state?: string }; status?: number; error?: string; response?: { message?: string | string[] } }
      | null;

    const state = data?.instance?.state;
    if (!res.ok) {
      const responseMessage = Array.isArray(data?.response?.message)
        ? data?.response?.message.join(", ")
        : data?.response?.message;
      return {
        connected: false,
        state,
        error: data?.error ?? responseMessage ?? `Evolution respondeu HTTP ${res.status}`,
      };
    }

    return { connected: state === "open", state };
  }

  /** Configura o webhook da instância apontando para o CRM (eventos de mensagem e grupo). */
  async configureWebhook(webhookUrl: string): Promise<void> {
    const base = this.creds.base_url.replace(/\/$/, "");
    const url = `${base}/webhook/set/${encodeURIComponent(this.creds.instance)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          base64: true,
          events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "GROUPS_UPSERT", "GROUP_PARTICIPANTS_UPDATE", "CONNECTION_UPDATE"],
        },
      }),
    });
    if (!res.ok) {
      const data = await res.text().catch(() => "");
      throw new Error(`Falha ao configurar webhook Evolution (HTTP ${res.status}): ${data.slice(0, 200)}`);
    }
  }

  async sendMedia(input: SendMediaInput): Promise<SendMessageResult> {
    const base = this.creds.base_url.replace(/\/$/, "");
    const number = input.to.replace(/\D/g, "");
    let url: string;
    let payload: Record<string, unknown>;

    if (input.mediaKind === "audio") {
      url = `${base}/message/sendWhatsAppAudio/${this.creds.instance}`;
      payload = { number, audio: input.mediaUrl };
    } else {
      url = `${base}/message/sendMedia/${this.creds.instance}`;
      payload = {
        number,
        mediatype: input.mediaKind, // image | video | document
        media: input.mediaUrl,
        ...(input.caption ? { caption: input.caption } : {}),
        ...(input.fileName ? { fileName: input.fileName } : {}),
        ...(input.mimeType ? { mimetype: input.mimeType } : {}),
      };
    }

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      PROVIDER_TIMEOUT_MEDIA_MS,
      "Evolution",
    );
    const data = (await res.json()) as { key?: { id?: string } };
    if (!res.ok) return { externalId: "", status: "failed", raw: data };
    return { externalId: data.key?.id ?? "", status: "sent", raw: data };
  }

  /** Evolution: envia como texto (sem HSM Meta). Junta variáveis do template. */
  async sendTemplate(input: SendTemplateInput): Promise<SendMessageResult> {
    const text = [`[${input.templateName}]`, ...input.bodyParameters].filter(Boolean).join("\n");
    return this.send({ to: input.to, body: text });
  }

  async fetchProfilePicture(phoneInput: string): Promise<string | null> {
    const phone = normalizeWhatsAppPhone(phoneInput);
    if (!phone) return null;

    const base = this.creds.base_url.replace(/\/$/, "");
    const url = `${base}/chat/fetchProfilePictureUrl/${encodeURIComponent(this.creds.instance)}`;
    for (const number of [phone, `${phone}@s.whatsapp.net`]) {
      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
      const data = (await res.json().catch(() => null)) as
        | { profilePictureUrl?: string; picture?: string; url?: string }
        | null;
      const picture = data?.profilePictureUrl ?? data?.picture ?? data?.url;
      if (typeof picture === "string" && picture.startsWith("http")) return picture;
    }
    return null;
  }

  parseWebhook(payload: unknown): InboundNormalized[] {
    const p = payload as {
      event?: string;
      data?: {
        key?: { id?: string; remoteJid?: string; fromMe?: boolean };
        message?: {
          conversation?: string;
          extendedTextMessage?: {
            text?: string;
            contextInfo?: {
              stanzaId?: string;
              participant?: string;
              quotedMessage?: {
                conversation?: string;
                extendedTextMessage?: { text?: string };
                imageMessage?: { caption?: string };
                videoMessage?: { caption?: string };
                documentMessage?: { caption?: string; fileName?: string };
                audioMessage?: unknown;
                stickerMessage?: unknown;
              };
              pushName?: string;
            };
          };
        };
        pushName?: string;
        messageTimestamp?: number;
      };
    };
    if (p.event !== "messages.upsert" || !p.data) return [];
    const remote = p.data.key?.remoteJid ?? "";
    if (!remote || remote.includes("@g.us")) return [];
    const fromPhone = remote.split("@")[0]?.replace(/\D/g, "") ?? "";
    if (!fromPhone) return [];
    const fromMe = Boolean(p.data.key?.fromMe);

    // Tentar pegar o texto da conversa
    let body = p.data.message?.conversation ?? p.data.message?.extendedTextMessage?.text;
    let mediaType: string | undefined = undefined;
    let mediaUrl: string | undefined = undefined;
    let mediaBase64: string | undefined = undefined;
    let mediaMimeType: string | undefined = undefined;
    let mediaFileName: string | undefined = undefined;

    const msgObj = p.data.message as any;
    if (msgObj?.audioMessage) {
        mediaType = "audio";
        mediaUrl = text(msgObj.audioMessage.url) || text(msgObj.audioMessage.directPath);
        mediaBase64 = text(msgObj.audioMessage.base64) || text(msgObj.base64);
        mediaMimeType = text(msgObj.audioMessage.mimetype);
        body ||= "🎤 Áudio";
    } else if (msgObj?.imageMessage) {
        mediaType = "image";
        mediaUrl = text(msgObj.imageMessage.url) || text(msgObj.imageMessage.directPath);
        mediaBase64 = text(msgObj.imageMessage.base64) || text(msgObj.base64);
        mediaMimeType = text(msgObj.imageMessage.mimetype);
        body ||= text(msgObj.imageMessage.caption) || "📷 Imagem";
    } else if (msgObj?.videoMessage) {
        mediaType = "video";
        mediaUrl = text(msgObj.videoMessage.url) || text(msgObj.videoMessage.directPath);
        mediaBase64 = text(msgObj.videoMessage.base64) || text(msgObj.base64);
        mediaMimeType = text(msgObj.videoMessage.mimetype);
        body ||= text(msgObj.videoMessage.caption) || "🎬 Vídeo";
    } else if (msgObj?.documentMessage) {
        mediaType = "document";
        mediaUrl = text(msgObj.documentMessage.url) || text(msgObj.documentMessage.directPath);
        mediaBase64 = text(msgObj.documentMessage.base64) || text(msgObj.base64);
        mediaMimeType = text(msgObj.documentMessage.mimetype);
        mediaFileName = text(msgObj.documentMessage.fileName);
        body ||= text(msgObj.documentMessage.caption) || "📎 Documento";
    } else if (msgObj?.stickerMessage) {
        mediaType = "sticker";
        mediaUrl = text(msgObj.stickerMessage.url) || text(msgObj.stickerMessage.directPath);
        mediaBase64 = text(msgObj.stickerMessage.base64) || text(msgObj.base64);
        mediaMimeType = text(msgObj.stickerMessage.mimetype);
        body ||= "🎭 Figurinha";
    }

    if (!body?.trim()) {
      // Sem texto e sem mídia identificável (ex: eventos de ruído, reações, etc), ignorar
      return [];
    }

    const messageObj = msgObj;
    const contextInfo =
      msgObj?.extendedTextMessage?.contextInfo ??
      msgObj?.imageMessage?.contextInfo ??
      msgObj?.videoMessage?.contextInfo ??
      msgObj?.documentMessage?.contextInfo ??
      msgObj?.audioMessage?.contextInfo ??
      msgObj?.stickerMessage?.contextInfo ??
      msgObj?.buttonsResponseMessage?.contextInfo ??
      msgObj?.templateButtonReplyMessage?.contextInfo ??
      msgObj?.listResponseMessage?.contextInfo ??
      msgObj?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    const quotedBody =
      text(quoted?.conversation) ??
      text(quoted?.extendedTextMessage?.text) ??
      text(quoted?.imageMessage?.caption) ??
      text(quoted?.videoMessage?.caption) ??
      text(quoted?.documentMessage?.caption) ??
      text(quoted?.documentMessage?.fileName) ??
      (quoted?.audioMessage ? "🎤 Áudio" : undefined) ??
      (quoted?.imageMessage ? "📷 Imagem" : undefined) ??
      (quoted?.videoMessage ? "🎬 Vídeo" : undefined) ??
      (quoted?.documentMessage ? "📎 Documento" : undefined) ??
      (quoted?.stickerMessage ? "🎭 Figurinha" : undefined);
    const normalizedReferral = normalizeReferral(messageObj);

    return [
      {
        externalId: p.data.key?.id ?? "",
        fromPhone,
        toPhone: "",
        direction: fromMe ? "outbound" : "inbound",
        body: body.trim(),
        mediaType,
        mediaUrl,
        mediaBase64,
        mediaMimeType,
        mediaFileName,
        timestamp: p.data.messageTimestamp
          ? new Date(p.data.messageTimestamp * 1000).toISOString()
          : new Date().toISOString(),
        contactName: fromMe ? undefined : p.data.pushName,
        quotedMessageId: text(contextInfo?.stanzaId),
        quotedBody: quotedBody ?? null,
        quotedSenderName: text(contextInfo?.pushName) ?? text(contextInfo?.participant) ?? null,
        referral: normalizedReferral,
      },
    ];
  }
}
