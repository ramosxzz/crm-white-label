import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { resolveZapiContact } from "./contact-ref";
import {
  isValidBrazilWhatsAppPhone,
  normalizeWhatsAppPhone,
  phonesEquivalent,
} from "./phone";
import { isZapiStatusOrBroadcastNoise } from "./zapi-noise";
import { zapiEventToDeliveryStatus } from "./zapi-status";
import type {
  InboundNormalized,
  SendMediaInput,
  SendMessageInput,
  SendMessageResult,
  SendTemplateInput,
  WhatsAppProvider,
} from "./provider";

interface ZapiCredentials {
  instance_id: string;
  token: string;
  client_token?: string;
}

/** Texto temporário quando só chega confirmação de envio (DeliveryCallback) sem corpo. */
export const ZAPI_PHONE_PLACEHOLDER = "Mensagem enviada pelo WhatsApp (celular)";

export type ZapiWebhookPayload = {
  type?: string;
  phone?: string;
  connectedPhone?: string;
  participantPhone?: string | null;
  senderPhone?: string | null;
  chatName?: string;
  senderName?: string;
  fromMe?: boolean;
  fromApi?: boolean;
  error?: string;
  zaapId?: string;
  isGroup?: boolean;
  isNewsletter?: boolean;
  broadcast?: boolean;
  isStatusReply?: boolean;
  waitingMessage?: boolean;
  notification?: string;
  momment?: number;
  moment?: number;
  messageId?: string;
  instanceId?: string;
  text?: { message?: string };
  image?: { imageUrl?: string; thumbnailUrl?: string; caption?: string };
  audio?: { audioUrl?: string; seconds?: number; ptt?: boolean; mimeType?: string };
  video?: { videoUrl?: string; caption?: string; seconds?: number };
  document?: { documentUrl?: string; fileName?: string; title?: string; mimeType?: string };
  sticker?: { stickerUrl?: string };
  location?: { latitude?: number; longitude?: number; name?: string };
  contact?: { displayName?: string };
  carouselMessage?: { text?: string };
  chatLid?: string | null;
  senderLid?: string | null;
  reaction?: unknown;
  pinMessage?: unknown;
  statusImage?: unknown;
  referenceMessageId?: string;
  status?: string;
  ids?: string[];
};

function zapiErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const msg =
      (typeof d.error === "string" && d.error) ||
      (typeof d.message === "string" && d.message) ||
      (typeof d.details === "string" && d.details);
    if (msg) return msg;
  }
  return `Z-API respondeu HTTP ${status}`;
}

function unwrapZapiPayload(payload: unknown): ZapiWebhookPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as ZapiWebhookPayload) : null;
  }
  if (p.data && typeof p.data === "object") return p.data as ZapiWebhookPayload;
  return payload as ZapiWebhookPayload;
}

function tryNormalizeContactPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (raw.includes("@lid") || raw.includes("@g.us") || raw.includes("broadcast")) return null;
  const normalized = normalizeWhatsAppPhone(raw);
  if (normalized) return normalized;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 13) {
    const retry = normalizeWhatsAppPhone(digits);
    if (retry) return retry;
  }
  return null;
}

function toInboundContact(
  p: ZapiWebhookPayload,
  fromMe: boolean,
  accountPhone?: string,
): { fromPhone: string; contactPhone?: string; contactLid?: string } | null {
  const contact = resolveZapiContact(p, fromMe, accountPhone);
  if (!contact) return null;
  const key = contact.phone ?? contact.lid;
  if (!key) return null;
  return {
    fromPhone: key,
    contactPhone: contact.phone ?? undefined,
    contactLid: contact.lid ?? undefined,
  };
}

export function extractZapiContent(p: ZapiWebhookPayload): {
  body: string;
  mediaUrl?: string;
  mediaType?: string;
} | null {
  const text = p.text?.message?.trim();
  if (text) return { body: text };

  const carouselText = p.carouselMessage?.text?.trim();
  if (carouselText) return { body: carouselText };

  if (p.audio?.audioUrl) {
    const sec = p.audio.seconds;
    const label = p.audio.ptt ? "Áudio" : "Áudio";
    return {
      body: sec ? `🎤 ${label} (${sec}s)` : `🎤 ${label}`,
      mediaUrl: p.audio.audioUrl,
      mediaType: p.audio.mimeType?.startsWith("audio/") ? "audio" : "audio",
    };
  }

  if (p.image?.imageUrl || p.image?.thumbnailUrl) {
    return {
      body: p.image.caption?.trim() || "📷 Imagem",
      mediaUrl: p.image.imageUrl ?? p.image.thumbnailUrl,
      mediaType: "image",
    };
  }

  if (p.video?.videoUrl) {
    return {
      body: p.video.caption?.trim() || (p.video.seconds ? `🎬 Vídeo (${p.video.seconds}s)` : "🎬 Vídeo"),
      mediaUrl: p.video.videoUrl,
      mediaType: "video",
    };
  }

  if (p.document?.documentUrl) {
    const name = p.document.fileName?.trim() || p.document.title?.trim() || "Documento";
    return {
      body: `📎 ${name}`,
      mediaUrl: p.document.documentUrl,
      mediaType: p.document.mimeType ?? "document",
    };
  }

  if (p.sticker?.stickerUrl) {
    return {
      body: "🎭 Figurinha",
      mediaUrl: p.sticker.stickerUrl,
      mediaType: "sticker",
    };
  }

  if (p.location) {
    const name = p.location.name?.trim();
    return { body: name ? `📍 ${name}` : "📍 Localização" };
  }

  if (p.contact?.displayName) {
    return { body: `👤 ${p.contact.displayName}` };
  }

  return null;
}

function parseZapiDeliveryCallback(p: ZapiWebhookPayload, accountPhone?: string): InboundNormalized[] {
  if (p.error?.trim()) return [];

  const contact = toInboundContact(
    { ...p, participantPhone: p.participantPhone ?? p.phone },
    true,
    accountPhone,
  );
  if (!contact) return [];

  const externalId = p.messageId?.trim() || p.zaapId?.trim() || "";
  if (!externalId) return [];

  const ts = p.momment ?? p.moment;

  return [
    {
      externalId,
      fromPhone: contact.fromPhone,
      contactPhone: contact.contactPhone,
      contactLid: contact.contactLid,
      toPhone: "",
      direction: "outbound",
      body: ZAPI_PHONE_PLACEHOLDER,
      timestamp: ts ? new Date(ts).toISOString() : new Date().toISOString(),
      contactName: (p.chatName || p.senderName || "").trim() || undefined,
    },
  ];
}

export function parseZapiWebhookPayload(payload: unknown, accountPhone?: string): InboundNormalized[] {
  const p = unwrapZapiPayload(payload);
  if (!p) return [];

  if (p.type === "MessageStatusCallback") return [];

  if (p.type === "DeliveryCallback") {
    return parseZapiDeliveryCallback(p, accountPhone);
  }

  if (p.isGroup || p.isNewsletter || p.broadcast) return [];
  if (isZapiStatusOrBroadcastNoise(p)) return [];
  if (p.notification || p.reaction || p.pinMessage) return [];

  const connected = tryNormalizeContactPhone(p.connectedPhone) || tryNormalizeContactPhone(accountPhone);
  const sender = tryNormalizeContactPhone(p.senderPhone);
  const fromMe = Boolean(p.fromMe) || Boolean(connected && sender && phonesEquivalent(sender, connected));

  const content = extractZapiContent(p);
  if (!content) return [];

  const isReceived = !p.type || p.type === "ReceivedCallback";
  if (!isReceived && !fromMe) return [];

  const contact = toInboundContact(p, fromMe, accountPhone);
  if (!contact) return [];

  const ts = p.momment ?? p.moment;
  const contactName = (p.chatName || p.senderName || "").trim() || undefined;
  const messageStatus = fromMe ? zapiEventToDeliveryStatus(p.status) : undefined;

  return [
    {
      externalId: p.messageId ?? "",
      fromPhone: contact.fromPhone,
      contactPhone: contact.contactPhone,
      contactLid: contact.contactLid,
      toPhone: "",
      direction: fromMe ? "outbound" : "inbound",
      body: content?.body ?? "…",
      mediaUrl: content?.mediaUrl,
      mediaType: content?.mediaType,
      timestamp: ts ? new Date(ts).toISOString() : new Date().toISOString(),
      contactName,
      messageStatus,
    },
  ];
}

export class ZapiProvider implements WhatsAppProvider {
  readonly kind = "zapi" as const;
  constructor(private account: WhatsAppAccount) {}

  private get creds(): ZapiCredentials {
    return this.account.credentials as unknown as ZapiCredentials;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const clientToken = this.creds.client_token?.trim();
    if (clientToken) h["Client-Token"] = clientToken;
    return h;
  }

  private basePath(suffix: string): string {
    const id = this.creds.instance_id?.trim();
    const token = this.creds.token?.trim();
    if (!id || !token) {
      throw new Error("Z-API: preencha Instance ID e Token nas credenciais do WhatsApp");
    }
    return `https://api.z-api.io/instances/${encodeURIComponent(id)}/token/${encodeURIComponent(token)}${suffix}`;
  }

  async getConnectionStatus(): Promise<{ connected: boolean; smartphoneConnected?: boolean; error?: string }> {
    const res = await fetch(this.basePath("/status"), { headers: this.headers() });
    const data = (await res.json()) as {
      connected?: boolean;
      smartphoneConnected?: boolean;
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      return { connected: false, error: zapiErrorMessage(data, res.status) };
    }
    return {
      connected: Boolean(data.connected),
      smartphoneConnected: data.smartphoneConnected,
      error: data.error ?? data.message,
    };
  }

  async getInstanceMe(): Promise<{
    receiveCallbackSentByMe?: boolean;
    receivedCallbackUrl?: string;
    deliveryCallbackUrl?: string;
  }> {
    const res = await fetch(this.basePath("/me"), { headers: this.headers() });
    const data = (await res.json()) as {
      receiveCallbackSentByMe?: boolean;
      receivedCallbackUrl?: string;
      deliveryCallbackUrl?: string;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(zapiErrorMessage(data, res.status));
    }
    return data;
  }

  /** Define URL única em todos webhooks + notifySentByMe (painel e API ficam alinhados). */
  async configureWebhooks(webhookUrl: string): Promise<void> {
    const url = webhookUrl.trim();
    if (!url.startsWith("https://")) {
      throw new Error("URL do webhook deve ser HTTPS.");
    }

    const res = await fetch(this.basePath("/update-every-webhooks"), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({ value: url, notifySentByMe: true }),
    });

    const data = (await res.json().catch(() => null)) as
      | { value?: boolean; error?: string; message?: string }
      | null;

    if (!res.ok || data?.error) {
      const msg = zapiErrorMessage(data, res.status);
      if (msg.includes("null not allowed") || res.status === 401) {
        throw new Error(
          "Z-API: Client-Token obrigatorio. Cole o Client Token (Seguranca da conta) no CRM e tente de novo.",
        );
      }
      throw new Error(`Z-API: falha ao configurar webhooks (${msg}).`);
    }

    await this.enableSentByMeWebhook();
  }

  async enableSentByMeWebhook(): Promise<void> {
    const res = await fetch(this.basePath("/update-notify-sent-by-me"), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({ notifySentByMe: true }),
    });

    const data = (await res.json().catch(() => null)) as
      | { value?: boolean; error?: string; message?: string }
      | null;

    if (!res.ok || data?.error) {
      const msg = zapiErrorMessage(data, res.status);
      if (msg.includes("null not allowed") || res.status === 401) {
        throw new Error(
          "Z-API: Client-Token obrigatorio para ativar mensagens enviadas pelo celular. Cole o Client Token da conta e tente de novo.",
        );
      }
      throw new Error(`Z-API: nao consegui ativar mensagens enviadas pelo celular (${msg}).`);
    }
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const phone = normalizeWhatsAppPhone(input.to);
    if (!phone) {
      throw new Error(
        `Telefone inválido (${input.to}). Use DDI + DDD + número, ex: 5511999999999`,
      );
    }

    const status = await this.getConnectionStatus();
    if (!status.connected) {
      throw new Error(
        status.error ??
          "Z-API: instância desconectada. Abra o painel Z-API, escaneie o QR Code e aguarde status conectado.",
      );
    }

    const res = await fetch(this.basePath("/send-text"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        phone,
        message: input.body ?? "",
      }),
    });

    const data = (await res.json()) as {
      messageId?: string;
      zaapId?: string;
      id?: string;
      error?: string;
      message?: string;
    };

    if (!res.ok || data.error) {
      const msg = zapiErrorMessage(data, res.status);
      if (msg.includes("null not allowed") || res.status === 401) {
        throw new Error(
          "Z-API: Client-Token obrigatório. No painel Z-API → Segurança → Token de segurança da conta: copie e cole em Client Token no CRM.",
        );
      }
      throw new Error(msg);
    }

    return {
      externalId: data.messageId ?? data.zaapId ?? data.id ?? "",
      status: "sent",
      raw: data,
    };
  }

  async sendMedia(input: SendMediaInput): Promise<SendMessageResult> {
    const phone = normalizeWhatsAppPhone(input.to);
    if (!phone) {
      throw new Error(
        `Telefone inválido (${input.to}). Use DDI + DDD + número, ex: 5511999999999`,
      );
    }

    const status = await this.getConnectionStatus();
    if (!status.connected) {
      throw new Error(
        status.error ??
          "Z-API: instância desconectada. Abra o painel Z-API, escaneie o QR Code e aguarde status conectado.",
      );
    }

    let path: string;
    let payload: Record<string, unknown>;

    switch (input.mediaKind) {
      case "image":
        path = "/send-image";
        payload = { phone, image: input.mediaUrl, caption: input.caption ?? "" };
        break;
      case "video":
        path = "/send-video";
        payload = { phone, video: input.mediaUrl, caption: input.caption ?? "" };
        break;
      case "audio":
        path = "/send-audio";
        payload = { phone, audio: input.mediaUrl };
        break;
      case "document":
      default: {
        const ext = (input.fileName?.split(".").pop() || "pdf").toLowerCase();
        path = `/send-document/${encodeURIComponent(ext)}`;
        payload = { phone, document: input.mediaUrl, fileName: input.fileName ?? `arquivo.${ext}` };
        break;
      }
    }

    const res = await fetch(this.basePath(path), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      messageId?: string;
      zaapId?: string;
      id?: string;
      error?: string;
      message?: string;
    };

    if (!res.ok || data.error) {
      const msg = zapiErrorMessage(data, res.status);
      if (msg.includes("null not allowed") || res.status === 401) {
        throw new Error(
          "Z-API: Client-Token obrigatório. No painel Z-API → Segurança → Token de segurança da conta: copie e cole em Client Token no CRM.",
        );
      }
      throw new Error(msg);
    }

    return {
      externalId: data.messageId ?? data.zaapId ?? data.id ?? "",
      status: "sent",
      raw: data,
    };
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendMessageResult> {
    const text = [`[${input.templateName}]`, ...input.bodyParameters].filter(Boolean).join("\n");
    return this.send({ to: input.to, body: text });
  }

  async fetchProfilePicture(phoneInput: string): Promise<string | null> {
    const phone = normalizeWhatsAppPhone(phoneInput);
    if (!phone) return null;

    const res = await fetch(`${this.basePath("/profile-picture")}?phone=${encodeURIComponent(phone)}`, {
      headers: this.headers(),
    });
    const data = (await res.json().catch(() => null)) as
      | { link?: string; error?: string; message?: string }
      | null;

    if (!res.ok || data?.error) return null;
    return typeof data?.link === "string" && data.link.startsWith("http") ? data.link : null;
  }

  parseWebhook(payload: unknown): InboundNormalized[] {
    return parseZapiWebhookPayload(payload, this.account.phone_number);
  }
}
