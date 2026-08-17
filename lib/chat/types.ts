export type ChatMessage = {
  id: string;
  external_id?: string | null;
  body: string | null;
  direction: "inbound" | "outbound";
  created_at: string;
  status: string;
  media_url?: string | null;
  media_type?: string | null;
  reply_to_message_id?: string | null;
  reply_to_external_id?: string | null;
  reply_to_body?: string | null;
  reply_to_sender_name?: string | null;
  user_id?: string | null;
  sender_name?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
};

export type ConversationStatus =
  | "nao_iniciada"
  | "aguardando"
  | "em_atendimento"
  | "resolvida";

export type ConversationListItem = {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadAvatarUrl: string | null;
  leadSubtitle: string;
  lastAt: string | null;
  unread: number;
  lastPreview: string | null;
  lastDirection: string | null;
  pinnedAt: string | null;
  status: ConversationStatus;
  whatsappAccountId: string | null;
  tags: string[];
  stageId: string | null;
  leadCreatedAt: string | null;
  callCount?: number;
  qualityStars: number;
  /** "digitando"/"gravando audio" ao vivo - null quando ninguem esta no ato. */
  presence?: "composing" | "recording" | null;
};
