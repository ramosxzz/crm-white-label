import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { WhatsAppAccount, Database } from "@/lib/supabase/database.types";
import type { ChatMessage } from "@/lib/chat/types";
import { fireAutomationTrigger } from "@/lib/automations/trigger";

export function providerErrorMessage(result: { status: string; raw?: unknown }): string {
  if (result.raw && typeof result.raw === "object") {
    const r = result.raw as Record<string, unknown>;
    if (typeof r.error === "string") return r.error;
    if (r.error && typeof r.error === "object") {
      const error = r.error as Record<string, unknown>;
      const errorData = error.error_data;
      if (errorData && typeof errorData === "object") {
        const details = (errorData as Record<string, unknown>).details;
        if (typeof details === "string") return details;
      }
      if (typeof error.message === "string") return error.message;
    }
    if (typeof r.message === "string") return r.message;
  }
  return "Falha ao enviar mensagem pelo WhatsApp";
}

function messageReplyPreview(message: { body?: string | null; media_type?: string | null }): string {
  const body = message.body?.trim();
  if (body) return body.slice(0, 240);
  const type = message.media_type?.toLowerCase() ?? "";
  if (type.startsWith("audio")) return "🎤 Áudio";
  if (type.startsWith("image")) return "📷 Imagem";
  if (type.startsWith("video")) return "🎬 Vídeo";
  if (type === "document" || type.startsWith("application")) return "📎 Documento";
  return "Mensagem";
}

export type SendChatMessageInput = {
  tenantId: string;
  userId: string | null;
  leadId: string;
  body: string;
  accountId?: string;
  replyToMessageId?: string | null;
  quickMessageId?: string;
};

/**
 * Nucleo do envio de mensagem WhatsApp, sem depender de sessao de usuario -
 * usado tanto pela Server Action do chat (app/(app)/chat/actions.ts) quanto
 * pela API publica (app/api/v1/messages), cada uma passando seu proprio
 * client Supabase (RLS de sessao ou service role) e tenantId/userId.
 */
export async function sendChatMessageCore(
  supabase: SupabaseClient<Database>,
  input: SendChatMessageInput,
): Promise<{ conversationId: string; message: ChatMessage }> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, name")
    .eq("id", input.leadId)
    .eq("tenant_id", input.tenantId)
    .single();
  if (!lead?.phone) throw new Error("Lead sem telefone");

  const to = normalizeWhatsAppPhone(lead.phone);
  if (to && to !== lead.phone.replace(/\D/g, "")) {
    void supabase.from("leads").update({ phone: to }).eq("id", lead.id).eq("tenant_id", input.tenantId);
  }

  let accountQuery = supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true);
  if (input.accountId) {
    accountQuery = accountQuery.eq("id", input.accountId);
  }

  let conversationId: string | undefined;
  const [{ data: account }, { data: conv }] = await Promise.all([
    accountQuery.limit(1).single(),
    supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("lead_id", lead.id)
      .eq("channel", "whatsapp")
      .maybeSingle(),
  ]);

  if (conv?.id) {
    conversationId = conv.id;
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        tenant_id: input.tenantId,
        lead_id: lead.id,
        whatsapp_account_id: account?.id ?? null,
        channel: "whatsapp",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversationId = created?.id;
  }

  if (!conversationId) throw new Error("Falha ao criar conversa");

  let replyTo:
    | {
        id: string;
        external_id: string | null;
        body: string | null;
        media_type: string | null;
        direction: "inbound" | "outbound";
        user_id: string | null;
      }
    | null = null;
  let replySenderName: string | null = null;
  if (input.replyToMessageId) {
    const { data } = await supabase
      .from("messages")
      .select("id, external_id, body, media_type, direction, user_id")
      .eq("id", input.replyToMessageId)
      .eq("tenant_id", input.tenantId)
      .eq("conversation_id", conversationId)
      .maybeSingle();
    replyTo = (data as typeof replyTo) ?? null;
    if (replyTo?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", replyTo.user_id)
        .maybeSingle();
      replySenderName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
    }
  }

  const { data: pendingMsg } = await supabase
    .from("messages")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: conversationId,
      user_id: input.userId,
      direction: "outbound",
      body: input.body,
      status: "pending",
      reply_to_message_id: replyTo?.id ?? null,
      reply_to_external_id: replyTo?.external_id ?? null,
      reply_to_body: replyTo ? messageReplyPreview(replyTo) : null,
      reply_to_sender_name: replyTo
        ? replySenderName ?? (replyTo.direction === "outbound" ? "Você" : lead.name)
        : null,
      quick_message_id: input.quickMessageId ?? null,
    })
    .select("id")
    .single();

  if (!account) {
    await supabase
      .from("messages")
      .update({ status: "failed", error: "Nenhuma conta WhatsApp configurada" })
      .eq("id", pendingMsg!.id);
    throw new Error("Configure uma conta WhatsApp em /settings/whatsapp");
  }

  try {
    const provider = createProvider(account as WhatsAppAccount);
    const result = await provider.send({
      to,
      body: input.body,
      quotedMessageId: replyTo?.external_id ?? null,
    });
    if (result.status !== "sent") {
      const errMsg = providerErrorMessage(result);
      await supabase
        .from("messages")
        .update({ status: "failed", error: errMsg })
        .eq("id", pendingMsg!.id);
      throw new Error(errMsg);
    }
    const { data: sentRow } = await supabase
      .from("messages")
      .update({
        status: "sent",
        external_id: result.externalId,
      })
      .eq("id", pendingMsg!.id)
      .select(
        "id, external_id, body, direction, created_at, status, reply_to_message_id, reply_to_external_id, reply_to_body, reply_to_sender_name",
      )
      .single();
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        status: "em_atendimento",
      })
      .eq("id", conversationId);

    void fireAutomationTrigger(input.tenantId, "message_sent", lead.id, {
      quick_message_id: input.quickMessageId ?? null,
    });

    return {
      conversationId,
      message: (sentRow ?? {
        id: pendingMsg!.id,
        external_id: result.externalId,
        body: input.body,
        direction: "outbound",
        created_at: new Date().toISOString(),
        status: "sent",
        reply_to_message_id: replyTo?.id ?? null,
        reply_to_external_id: replyTo?.external_id ?? null,
        reply_to_body: replyTo ? messageReplyPreview(replyTo) : null,
        reply_to_sender_name: replyTo
          ? replySenderName ?? (replyTo.direction === "outbound" ? "Você" : lead.name)
          : null,
      }) as ChatMessage,
    };
  } catch (e) {
    await supabase
      .from("messages")
      .update({ status: "failed", error: (e as Error).message })
      .eq("id", pendingMsg!.id);
    throw e;
  }
}
