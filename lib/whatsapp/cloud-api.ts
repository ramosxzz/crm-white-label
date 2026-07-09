import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import type {
  InboundNormalized,
  SendMediaInput,
  SendMessageInput,
  SendMessageResult,
  SendTemplateInput,
  WhatsAppProvider,
} from "./provider";

interface CloudApiCredentials {
  access_token: string;
  phone_number_id: string;
  business_account_id?: string;
  graph_version?: string;
  app_secret?: string;
}

type CloudMessageMedia = {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
};

type CloudWebhookMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: CloudMessageMedia;
  audio?: CloudMessageMedia;
  video?: CloudMessageMedia;
  document?: CloudMessageMedia;
  sticker?: CloudMessageMedia;
  button?: { text?: string };
  interactive?: {
    type?: string;
    button_reply?: { title?: string; id?: string };
    list_reply?: { title?: string; description?: string; id?: string };
  };
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  contacts?: Array<{ name?: { formatted_name?: string } }>;
  reaction?: { emoji?: string; message_id?: string };
  referral?: {
    source_id?: string;
    source_type?: string;
    source_url?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
  };
  context?: { id?: string; from?: string; referred_product?: unknown };
};

type CloudWebhookStatus = {
  id: string;
  recipient_id?: string;
  status?: string;
  timestamp?: string;
};

type CloudWebhookValue = {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: CloudWebhookMessage[];
  statuses?: CloudWebhookStatus[];
};

type CloudWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: CloudWebhookValue;
    }>;
  }>;
};

export class CloudApiProvider implements WhatsAppProvider {
  readonly kind = "cloud_api" as const;

  constructor(private account: WhatsAppAccount) {}

  private get creds(): CloudApiCredentials {
    return this.account.credentials as unknown as CloudApiCredentials;
  }

  private get graphVersion() {
    return this.creds.graph_version || process.env.WHATSAPP_GRAPH_VERSION || "v20.0";
  }

  private graphUrl(path: string) {
    return `https://graph.facebook.com/${this.graphVersion}/${path.replace(/^\/+/, "")}`;
  }

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.creds.access_token}`,
      "Content-Type": "application/json",
    };
  }

  private messagesUrl() {
    return this.graphUrl(`${this.creds.phone_number_id}/messages`);
  }

  private mediaTypeForMime(mimeType?: string | null) {
    if (mimeType?.startsWith("image/")) return "image";
    if (mimeType?.startsWith("video/")) return "video";
    if (mimeType?.startsWith("audio/")) return "audio";
    return "document";
  }

  private buildMediaPayload(input: {
    mediaUrl: string;
    mediaKind: "image" | "video" | "audio" | "document";
    caption?: string;
    fileName?: string;
  }) {
    const media: Record<string, unknown> = { link: input.mediaUrl };
    if (input.mediaKind !== "audio" && input.caption) {
      media.caption = input.caption;
    }
    if (input.mediaKind === "document" && input.fileName) {
      media.filename = input.fileName;
    }
    return media;
  }

  private async postMessage(body: Record<string, unknown>): Promise<SendMessageResult> {
    const res = await fetch(this.messagesUrl(), {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; error_data?: { details?: string } };
    };
    if (!res.ok) {
      return { externalId: "", status: "failed", raw: data };
    }
    return {
      externalId: data.messages?.[0]?.id ?? "",
      status: "sent",
      raw: data,
    };
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: input.to.replace(/\D/g, ""),
    };
    if (input.mediaUrl) {
      const mediaKind = this.mediaTypeForMime(input.mediaType);
      body.type = mediaKind;
      body[mediaKind] = this.buildMediaPayload({
        mediaUrl: input.mediaUrl,
        mediaKind,
        caption: input.body,
      });
    } else {
      body.type = "text";
      body.text = { body: input.body ?? "" };
    }
    if (input.quotedMessageId) {
      body.context = { message_id: input.quotedMessageId };
    }

    return this.postMessage(body);
  }

  async sendMedia(input: SendMediaInput): Promise<SendMessageResult> {
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: input.to.replace(/\D/g, ""),
      type: input.mediaKind,
      [input.mediaKind]: this.buildMediaPayload({
        mediaUrl: input.mediaUrl,
        mediaKind: input.mediaKind,
        caption: input.caption,
        fileName: input.fileName,
      }),
    };

    return this.postMessage(body);
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendMessageResult> {
    const parameters = input.bodyParameters.map((text) => ({
      type: "text" as const,
      text,
    }));
    const templateObj: Record<string, unknown> = {
      name: input.templateName,
      language: { code: input.languageCode },
    };
    if (parameters.length > 0) {
      templateObj.components = [{ type: "body", parameters }];
    }
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: input.to.replace(/\D/g, ""),
      type: "template",
      template: templateObj,
    };

    return this.postMessage(body);
  }

  async getPhoneNumberStatus() {
    const fields = [
      "id",
      "display_phone_number",
      "verified_name",
      "quality_rating",
      "code_verification_status",
    ].join(",");
    const res = await fetch(this.graphUrl(`${this.creds.phone_number_id}?fields=${fields}`), {
      headers: { Authorization: `Bearer ${this.creds.access_token}` },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      code_verification_status?: string;
      error?: { message?: string; error_data?: { details?: string } };
    };
    if (!res.ok) {
      const message = data.error?.error_data?.details || data.error?.message || "Falha ao consultar a Cloud API";
      throw new Error(message);
    }
    return data;
  }

  async subscribeWebhookApp() {
    if (!this.creds.business_account_id) return { skipped: true };
    const res = await fetch(this.graphUrl(`${this.creds.business_account_id}/subscribed_apps`), {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({}),
    });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: { message?: string; error_data?: { details?: string } };
    };
    if (!res.ok) {
      const message = data.error?.error_data?.details || data.error?.message || "Falha ao assinar webhooks da WABA";
      throw new Error(message);
    }
    return { skipped: false, raw: data };
  }

  parseWebhook(payload: unknown): InboundNormalized[] {
    const result: InboundNormalized[] = [];
    const entries = (payload as CloudWebhookPayload).entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const toPhone = value.metadata?.display_phone_number ?? "";
        for (const status of value.statuses ?? []) {
          const mappedStatus = mapCloudStatus(status.status);
          if (!mappedStatus) continue;
          result.push({
            externalId: status.id,
            fromPhone: status.recipient_id ?? "",
            contactPhone: status.recipient_id ?? null,
            toPhone,
            direction: "outbound",
            timestamp: status.timestamp
              ? new Date(Number(status.timestamp) * 1000).toISOString()
              : new Date().toISOString(),
            messageStatus: mappedStatus,
          });
        }

        for (const msg of value.messages ?? []) {
          const contact = value.contacts?.find((c) => c.wa_id === msg.from) ?? value.contacts?.[0];
          const contactName = contact?.profile?.name;
          const media =
            msg.image ??
            msg.audio ??
            msg.video ??
            msg.document ??
            msg.sticker;
          const fallbackBody = fallbackBodyForMessage(msg);
          result.push({
            externalId: msg.id,
            fromPhone: msg.from,
            contactPhone: msg.from,
            toPhone,
            direction: "inbound",
            body: msg.text?.body ?? fallbackBody,
            mediaUrl: media?.id ? `cloud_api:${media.id}` : undefined,
            mediaType: msg.type,
            mediaMimeType: media?.mime_type,
            mediaFileName: media?.filename,
            quotedMessageId: msg.context?.id ?? null,
            timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
            contactName,
            referral: msg.referral?.source_id && msg.referral.source_type
              ? {
                  sourceId: msg.referral.source_id,
                  sourceType: msg.referral.source_type,
                  sourceUrl: msg.referral.source_url,
                  headline: msg.referral.headline,
                  body: msg.referral.body,
                  mediaType: msg.referral.media_type,
                  imageUrl: msg.referral.image_url,
                  videoUrl: msg.referral.video_url,
                }
              : null,
          });
        }
      }
    }
    return result;
  }
}

function mapCloudStatus(status?: string): "sent" | "delivered" | "read" | null {
  if (status === "sent" || status === "delivered" || status === "read") return status;
  return null;
}

function fallbackBodyForMessage(msg: CloudWebhookMessage) {
  if (msg.type === "image") return msg.image?.caption || "📷 Imagem";
  if (msg.type === "audio") return "🎤 Áudio";
  if (msg.type === "video") return msg.video?.caption || "🎬 Vídeo";
  if (msg.type === "document") return `📎 ${msg.document?.filename ?? "Documento"}`;
  if (msg.type === "sticker") return "Figurinha";
  if (msg.type === "button") return msg.button?.text ?? "Botão";
  if (msg.type === "interactive") {
    return (
      msg.interactive?.button_reply?.title ??
      msg.interactive?.list_reply?.title ??
      "Resposta interativa"
    );
  }
  if (msg.type === "location") {
    return msg.location?.name || msg.location?.address || "📍 Localização";
  }
  if (msg.type === "contacts") {
    return msg.contacts?.[0]?.name?.formatted_name
      ? `👤 ${msg.contacts[0].name.formatted_name}`
      : "👤 Contato";
  }
  if (msg.type === "reaction") return msg.reaction?.emoji ?? "Reação";
  return undefined;
}
