import type { WhatsAppAccount } from "@/lib/supabase/database.types";

export interface SendMessageInput {
  to: string;
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  quotedMessageId?: string | null;
}

export type MediaKind = "image" | "video" | "audio" | "document";

export interface SendMediaInput {
  to: string;
  mediaUrl: string;
  mediaKind: MediaKind;
  caption?: string;
  fileName?: string;
  mimeType?: string;
}

/** Meta Cloud API template (HSM). Evolution/Z-API: converted to plain text in adapters. */
export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  /** Ordered body variable values ({{1}}, {{2}}, …) */
  bodyParameters: string[];
}

export interface SendMessageResult {
  externalId: string;
  status: "sent" | "pending" | "failed";
  raw?: unknown;
}

export interface EditMessageInput {
  to: string;
  externalId: string;
  body: string;
}

export interface DeleteMessageInput {
  to: string;
  externalId: string;
  fromMe: boolean;
}

export interface InboundNormalized {
  externalId: string;
  /** Telefone do lead/contato (legado; use contactPhone/contactLid). */
  fromPhone: string;
  contactPhone?: string | null;
  contactLid?: string | null;
  toPhone: string;
  direction: "inbound" | "outbound";
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  timestamp: string;
  contactName?: string;
  quotedMessageId?: string | null;
  quotedBody?: string | null;
  quotedSenderName?: string | null;
  /** Status de entrega/leitura (mensagens enviadas). */
  messageStatus?: "sent" | "delivered" | "read";
  referral?: {
    sourceId: string;
    sourceType: string;
    sourceUrl?: string;
    headline?: string;
    body?: string;
    mediaType?: string;
    imageUrl?: string;
    videoUrl?: string;
  } | null;
}

export interface WhatsAppProvider {
  readonly kind: "cloud_api" | "evolution" | "zapi";
  send(input: SendMessageInput): Promise<SendMessageResult>;
  /** Optional: not all providers support Meta-style templates; fallback is plain text. */
  sendTemplate?(input: SendTemplateInput): Promise<SendMessageResult>;
  /** Envia mídia (imagem, vídeo, áudio, documento) a partir de uma URL pública. */
  sendMedia?(input: SendMediaInput): Promise<SendMessageResult>;
  /** Busca a foto publica do perfil do contato, quando o provedor disponibiliza. */
  fetchProfilePicture?(phone: string): Promise<string | null>;
  /** Edita uma mensagem de texto ja enviada, quando o provedor oferece suporte. */
  editMessage?(input: EditMessageInput): Promise<void>;
  /** Apaga uma mensagem para todos, quando o provedor oferece suporte. */
  deleteMessage?(input: DeleteMessageInput): Promise<void>;
  parseWebhook(payload: unknown): InboundNormalized[];
}
