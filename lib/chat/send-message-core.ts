import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { WhatsAppAccount, Database } from "@/lib/supabase/database.types";
import type { ChatMessage } from "@/lib/chat/types";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { applyStageTriggerPhrase } from "@/lib/leads/stage-trigger-phrase";

export function providerErrorMessage(result: { status: string; raw?: unknown }): string {
  const messages: string[] = [];
  function collect(value: unknown, depth = 0) {
    if (depth > 6 || value == null) return;
    if (typeof value === "string" && value.trim()) {
      messages.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => collect(item, depth + 1));
      return;
    }
    if (typeof value === "object") {
      const row = value as Record<string, unknown>;
      ["details", "message", "error_description", "error", "response", "output", "payload"].forEach((key) =>
        collect(row[key], depth + 1),
      );
    }
  }
  collect(result.raw);
  const connectionError = messages.find((message) => /connection closed|not connected|disconnected/i.test(message));
  if (connectionError) {
    return "A conexão deste número do WhatsApp está fechada. Reconecte a conta e tente novamente.";
  }
  const preconditionError = messages.find((message) => /precondition required/i.test(message));
  if (preconditionError) {
    return "Este número do WhatsApp não está pronto para enviar. Reconecte a conta e tente novamente.";
  }
  const specific = messages.find(
    (message) => !/^(internal server error|bad request|error|failed)$/i.test(message),
  );
  if (specific) return specific;
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

  let conversationId: string | undefined;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, whatsapp_account_id")
    .eq("tenant_id", input.tenantId)
    .eq("lead_id", lead.id)
    .eq("channel", "whatsapp")
    .maybeSingle();

  const preferredAccountId = input.accountId ?? conv?.whatsapp_account_id ?? undefined;
  let accountQuery = supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true)
    .neq("health_status", "offline");
  if (preferredAccountId) accountQuery = accountQuery.eq("id", preferredAccountId);
  let { data: account } = await accountQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!account && !preferredAccountId && input.userId) {
    const result = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("tenant_id", input.tenantId)
      .eq("is_active", true)
      .neq("health_status", "offline")
      .eq("assigned_to", input.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    account = result.data;
  }

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

  type ReplyToRow = {
    id: string;
    external_id: string | null;
    body: string | null;
    media_type: string | null;
    direction: "inbound" | "outbound";
    user_id: string | null;
  };
  // `typeof replyTo` dentro da propria atribuicao de replyTo faz o TS inferir
  // `never` (self-reference na expressao) - por isso o tipo tem nome proprio
  // em vez de ser inline na declaracao do let.
  let replyTo: ReplyToRow | null = null;
  let replySenderName: string | null = null;
  if (input.replyToMessageId) {
    const { data } = await supabase
      .from("messages")
      .select("id, external_id, body, media_type, direction, user_id")
      .eq("id", input.replyToMessageId)
      .eq("tenant_id", input.tenantId)
      .eq("conversation_id", conversationId)
      .maybeSingle();
    replyTo = (data as ReplyToRow | null) ?? null;
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
        whatsapp_account_id: account.id,
      })
      .eq("id", conversationId);

    void fireAutomationTrigger(input.tenantId, "message_sent", lead.id, {
      quick_message_id: input.quickMessageId ?? null,
    });
    void applyStageTriggerPhrase(supabase, input.tenantId, lead.id, input.body);

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
