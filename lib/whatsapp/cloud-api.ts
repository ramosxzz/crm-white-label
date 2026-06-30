import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import type {
  InboundNormalized,
  SendMessageInput,
  SendMessageResult,
  SendTemplateInput,
  WhatsAppProvider,
} from "./provider";

interface CloudApiCredentials {
  access_token: string;
  phone_number_id: string;
  app_secret?: string;
}

export class CloudApiProvider implements WhatsAppProvider {
  readonly kind = "cloud_api" as const;

  constructor(private account: WhatsAppAccount) {}

  private get creds(): CloudApiCredentials {
    return this.account.credentials as unknown as CloudApiCredentials;
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const url = `https://graph.facebook.com/v20.0/${this.creds.phone_number_id}/messages`;
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: input.to.replace(/\D/g, ""),
      type: input.mediaUrl ? (input.mediaType?.startsWith("image/") ? "image" : "document") : "text",
    };
    if (input.mediaUrl) {
      const t = input.mediaType?.startsWith("image/") ? "image" : "document";
      body[t] = { link: input.mediaUrl, caption: input.body };
    } else {
      body.text = { body: input.body ?? "" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.creds.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) {
      return { externalId: "", status: "failed", raw: data };
    }
    return {
      externalId: data.messages?.[0]?.id ?? "",
      status: "sent",
      raw: data,
    };
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendMessageResult> {
    const url = `https://graph.facebook.com/v20.0/${this.creds.phone_number_id}/messages`;
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

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.creds.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok) {
      return { externalId: "", status: "failed", raw: data };
    }
    return {
      externalId: data.messages?.[0]?.id ?? "",
      status: "sent",
      raw: data,
    };
  }

  parseWebhook(payload: unknown): InboundNormalized[] {
    const result: InboundNormalized[] = [];
    type Entry = {
      changes?: Array<{
        value?: {
          metadata?: { display_phone_number?: string };
          contacts?: Array<{ profile?: { name?: string } }>;
          messages?: Array<{
            id: string;
            from: string;
            timestamp: string;
            type: string;
            text?: { body?: string };
            image?: { id?: string; mime_type?: string };
            audio?: { id?: string; mime_type?: string };
            video?: { id?: string; mime_type?: string };
            document?: { id?: string; mime_type?: string; filename?: string };
            sticker?: { id?: string; mime_type?: string };
          }>;
        };
      }>;
    };
    const entries = (payload as { entry?: Entry[] }).entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const toPhone = value.metadata?.display_phone_number ?? "";
        const contactName = value.contacts?.[0]?.profile?.name;
        for (const msg of value.messages ?? []) {
          const media =
            msg.image ??
            msg.audio ??
            msg.video ??
            msg.document ??
            msg.sticker;
          const fallbackBody =
            msg.type === "image"
              ? "📷 Imagem"
              : msg.type === "audio"
                ? "🎤 Áudio"
                : msg.type === "video"
                  ? "🎬 Vídeo"
                  : msg.type === "document"
                    ? `📎 ${msg.document?.filename ?? "Documento"}`
                    : msg.type === "sticker"
                      ? "Figurinha"
                      : undefined;
          result.push({
            externalId: msg.id,
            fromPhone: msg.from,
            toPhone,
            direction: "inbound",
            body: msg.text?.body ?? fallbackBody,
            mediaUrl: media?.id ? `cloud_api:${media.id}` : undefined,
            mediaType: msg.type,
            timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
            contactName,
          });
        }
      }
    }
    return result;
  }
}
