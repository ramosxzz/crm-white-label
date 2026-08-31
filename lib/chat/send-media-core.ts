import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { MediaKind } from "@/lib/whatsapp/provider";
import type { WhatsAppAccount, Database } from "@/lib/supabase/database.types";
import type { ChatMessage } from "@/lib/chat/types";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { providerErrorMessage } from "@/lib/chat/send-message-core";
import { convertToOggOpus } from "@/lib/media/transcode-audio";

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
 * Audio gravado no navegador chega como webm/opus (Chrome nao grava em ogg
 * nativo). O WhatsApp (Baileys/Evolution) so acerta a duracao e o player de
 * nota de voz quando o audio e Opus dentro de um container OGG de verdade -
 * webm tem outro layout de metadata e o WhatsApp mostra duracao errada
 * (ex: audio de 10s aparece como 2:00) ou nem toca. Reconverte aqui antes
 * de mandar, e ja fica um .ogg valido salvo pra proxima vez que abrir.
 */
async function ensureOggAudio(
  supabase: SupabaseClient<Database>,
  input: { tenantId: string; leadId: string; mediaUrl: string; mimeType?: string },
): Promise<{ mediaUrl: string; mimeType: string }> {
  const mime = (input.mimeType ?? "").toLowerCase();
  const alreadyOgg = mime.includes("ogg") || input.mediaUrl.toLowerCase().endsWith(".ogg");
  if (alreadyOgg) return { mediaUrl: input.mediaUrl, mimeType: input.mimeType ?? "audio/ogg; codecs=opus" };

  try {
    const res = await fetch(input.mediaUrl);
    if (!res.ok) throw new Error(`Falha ao baixar audio original (${res.status})`);
    const original = Buffer.from(await res.arrayBuffer());
    const converted = await convertToOggOpus(original);

    const path = `${input.tenantId}/${input.leadId}/${crypto.randomUUID()}-audio.ogg`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, converted, {
      cacheControl: "3600",
      upsert: false,
      // O bucket valida o content-type contra uma lista exata de MIME
      // permitidos, e "audio/ogg; codecs=opus" (com o parametro) nao bate
      // com "audio/ogg" da lista - toda conversao vinha falhando aqui com
      // "mime type ... is not supported", caindo no catch e mandando o
      // webm cru pro WhatsApp (que o cliente via como "indisponivel").
      // O storage so precisa do tipo base; o codec vai no mimeType
      // devolvido abaixo, que e o que o envio pro WhatsApp de fato usa.
      contentType: "audio/ogg",
    });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
    return { mediaUrl: pub.publicUrl, mimeType: "audio/ogg; codecs=opus" };
  } catch (err) {
    // Sem ffmpeg/conversao no ar por algum motivo: manda o original mesmo
    // (webm), melhor arriscar duracao errada do que nao mandar nada.
    console.error("[chat] falha ao converter audio pra ogg, mandando original", err);
    return { mediaUrl: input.mediaUrl, mimeType: input.mimeType ?? "audio/webm" };
  }
}

/**
 * Nucleo do envio de midia WhatsApp, sem depender de sessao de usuario -
 * usado pela Server Action do chat (app/(app)/chat/actions.ts) e pelo
 * dispatcher de disparo em massa (lib/disparos/dispatcher.ts).
 */
export async function sendChatMediaCore(
  supabase: SupabaseClient<Database>,
  rawInput: SendChatMediaInput,
): Promise<{ conversationId: string; message: ChatMessage }> {
  if (!rawInput.mediaUrl) throw new Error("Mídia ausente");

  const input =
    rawInput.mediaKind === "audio"
      ? {
          ...rawInput,
          ...(await ensureOggAudio(supabase, {
            tenantId: rawInput.tenantId,
            leadId: rawInput.leadId,
            mediaUrl: rawInput.mediaUrl,
            mimeType: rawInput.mimeType,
          })),
        }
      : rawInput;

  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, name")
    .eq("id", input.leadId)
    .eq("tenant_id", input.tenantId)
    .single();
  if (!lead?.phone) throw new Error("Lead sem telefone");

  const to = normalizeWhatsAppPhone(lead.phone) ?? lead.phone.replace(/\D/g, "");

  let conversationId: string | undefined;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, whatsapp_account_id")
    .eq("tenant_id", input.tenantId)
    .eq("lead_id", lead.id)
    .eq("channel", "whatsapp")
    .maybeSingle();

  const preferredAccountId = input.accountId ?? conv?.whatsapp_account_id ?? undefined;
  let mediaAccountQuery = supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("is_active", true)
    .neq("health_status", "offline");
  if (preferredAccountId) mediaAccountQuery = mediaAccountQuery.eq("id", preferredAccountId);
  let { data: account } = await mediaAccountQuery.order("created_at", { ascending: true }).limit(1).maybeSingle();
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
      .update({ status: "sent", external_id: result.externalId, remote_phone: to })
      .eq("id", pendingMsg!.id)
      .select("id, external_id, body, direction, created_at, status, media_url, media_type")
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

    return {
      conversationId,
      message: (sentRow ?? {
        id: pendingMsg!.id,
        external_id: result.externalId,
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
