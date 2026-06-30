import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import type {
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

export class EvolutionProvider implements WhatsAppProvider {
  readonly kind = "evolution" as const;
  constructor(private account: WhatsAppAccount) {}

  private get creds(): EvolutionCredentials {
    return this.account.credentials as unknown as EvolutionCredentials;
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const url = `${this.creds.base_url.replace(/\/$/, "")}/message/sendText/${this.creds.instance}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
      body: JSON.stringify({
        number: input.to.replace(/\D/g, ""),
        text: input.body ?? "",
      }),
    });
    const data = (await res.json()) as { key?: { id?: string } };
    if (!res.ok) return { externalId: "", status: "failed", raw: data };
    return { externalId: data.key?.id ?? "", status: "sent", raw: data };
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
          events: ["MESSAGES_UPSERT", "GROUPS_UPSERT", "GROUP_PARTICIPANTS_UPDATE", "CONNECTION_UPDATE"],
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

    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: this.creds.api_key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { key?: { id?: string } };
    if (!res.ok) return { externalId: "", status: "failed", raw: data };
    return { externalId: data.key?.id ?? "", status: "sent", raw: data };
  }

  /** Evolution: envia como texto (sem HSM Meta). Junta variáveis do template. */
  async sendTemplate(input: SendTemplateInput): Promise<SendMessageResult> {
    const text = [`[${input.templateName}]`, ...input.bodyParameters].filter(Boolean).join("\n");
    return this.send({ to: input.to, body: text });
  }

  parseWebhook(payload: unknown): InboundNormalized[] {
    const p = payload as {
      event?: string;
      data?: {
        key?: { id?: string; remoteJid?: string; fromMe?: boolean };
        message?: { conversation?: string; extendedTextMessage?: { text?: string } };
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
    let normalizedReferral = null;
    const rawReferral = messageObj?.referral ?? messageObj?.extendedTextMessage?.contextInfo?.externalAdReply;
    if (rawReferral && (rawReferral.sourceId || rawReferral.source_id)) {
      normalizedReferral = {
        sourceId: String(rawReferral.sourceId ?? rawReferral.source_id),
        sourceType: String(rawReferral.sourceType ?? rawReferral.source_type ?? "ad"),
        sourceUrl: rawReferral.sourceUrl ?? rawReferral.source_url ?? undefined,
        headline: rawReferral.headline ?? undefined,
        body: rawReferral.body ?? undefined,
        mediaType: rawReferral.mediaType ?? rawReferral.media_type ?? undefined,
        imageUrl: rawReferral.imageUrl ?? rawReferral.image_url ?? undefined,
        videoUrl: rawReferral.videoUrl ?? rawReferral.video_url ?? undefined,
      };
    }

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
        contactName: p.data.pushName,
        referral: normalizedReferral,
      },
    ];
  }
}
