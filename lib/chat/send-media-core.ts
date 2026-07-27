import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { MediaKind } from "@/lib/whatsapp/provider";
import type { WhatsAppAccount, Database } from "@/lib/supabase/database.types";
import type { ChatMessage } from "@/lib/chat/types";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { providerErrorMessage } from "@/lib/chat/send-message-core";

export type SendChatMediaInput = {
  tenantId: string;
  userId: string | null;
  leadId: string;
  mediaUrl: string;
  mediaKind: MediaKind;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  accountId?: string;
  quickMessageId?: string;
};

/**
 * Nucleo do envio de midia WhatsApp, sem depender de sessao de usuario -
 * usado pela Server Action do chat (app/(app)/chat/actions.ts) e pelo
 * dispatcher de disparo em massa (lib/disparos/dispatcher.ts).
 */
export async function sendChatMediaCore(
  supabase: SupabaseClient<Database>,
  input: SendChatMediaInput,
): Promise<{ conversationId: string; message: ChatMessage }> {
  if (!input.mediaUrl) throw new Error("Mídia ausente");

  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, name")
    .eq("id", input.leadId)
    .eq("tenant_id", input.tenantId)
    .single();
  if (!lead?.phone) throw new Error("Lead sem telefone");

  const to = normalizeWhatsAppPhone(lead.phone) ?? lead.phone.replace(/\D/g, "");

  let mediaAccountQuery = supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true);
  if (input.accountId) {
    mediaAccountQuery = mediaAccountQuery.eq("id", input.accountId);
  }
  const { data: account } = await mediaAccountQuery.limit(1).single();

  let conversationId: string | undefined;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("lead_id", lead.id)
    .eq("channel", "whatsapp")
    .maybeSingle();

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

  const previewBody =
    input.caption?.trim() ||
    (input.mediaKind === "image"
      ? "📷 Imagem"
      : input.mediaKind === "video"
        ? "🎬 Vídeo"
        : input.mediaKind === "audio"
          ? "🎤 Áudio"
          : `📎 ${input.fileName ?? "Documento"}`);

  const { data: pendingMsg } = await supabase
    .from("messages")
    .insert({
      tenant_id: input.tenantId,
      conversation_id: conversationId,
      user_id: input.userId,
      direction: "outbound",
      body: previewBody,
      media_url: input.mediaUrl,
      media_type: input.mediaKind,
      status: "pending",
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
    if (!provider.sendMedia) {
      throw new Error("Este provedor de WhatsApp não suporta envio de mídia.");
    }
    const result = await provider.sendMedia({
      to,
      mediaUrl: input.mediaUrl,
      mediaKind: input.mediaKind,
      caption: input.caption,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });
    if (result.status !== "sent") {
      const errMsg = providerErrorMessage(result);
      await supabase.from("messages").update({ status: "failed", error: errMsg }).eq("id", pendingMsg!.id);
      throw new Error(errMsg);
    }
    const { data: sentRow } = await supabase
      .from("messages")
      .update({ status: "sent", external_id: result.externalId })
      .eq("id", pendingMsg!.id)
      .select("id, body, direction, created_at, status, media_url, media_type")
      .single();
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), status: "em_atendimento" })
      .eq("id", conversationId);

    void fireAutomationTrigger(input.tenantId, "message_sent", lead.id, {
      quick_message_id: input.quickMessageId ?? null,
    });

    return {
      conversationId,
      message: (sentRow ?? {
        id: pendingMsg!.id,
        body: previewBody,
        direction: "outbound",
        created_at: new Date().toISOString(),
        status: "sent",
        media_url: input.mediaUrl,
        media_type: input.mediaKind,
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
