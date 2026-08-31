"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import type { ChatMessage } from "@/lib/chat/types";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { logLeadActivity } from "@/lib/leads/activity-log";
import { notifyUser } from "@/lib/notifications/notify";
import { sendChatMessageCore } from "@/lib/chat/send-message-core";
import { sendChatMediaCore } from "@/lib/chat/send-media-core";
import { createProvider } from "@/lib/whatsapp/factory";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import {
  canAccessConversationAccount,
  getChatAccountVisibility,
} from "@/lib/chat/list-conversation-items";
import { normalizePhone } from "@/lib/utils";
import { recordAccountHealthHeartbeat } from "@/lib/whatsapp/health-checker";

type ChatSendActionResult =
  | { ok: true; conversationId: string; message: ChatMessage }
  | { ok: false; error: string };

function publicSendError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/conexão.*fechada|connection closed|not connected|disconnected/i.test(message)) {
    return "A conexão deste número do WhatsApp está fechada. Reconecte a conta e tente novamente.";
  }
  if (/timeout|timed out|aborted/i.test(message)) {
    return "O WhatsApp demorou demais para responder. Verifique a conexão da conta e tente novamente.";
  }
  if (/sem acesso|não possui acesso/i.test(message)) return "Você não possui acesso a este número do WhatsApp.";
  if (/lead sem telefone/i.test(message)) return "Este lead não possui um telefone válido.";
  if (/configure uma conta|nenhuma conta/i.test(message)) return "Nenhuma conta do WhatsApp disponível para este usuário.";
  if (message && !/internal server error/i.test(message)) return message;
  return "Não foi possível enviar pelo WhatsApp agora. Verifique a conexão do número e tente novamente.";
}

async function resolveAccessibleAccountId(
  ctx: Awaited<ReturnType<typeof requireContext>>,
  requestedAccountId?: string,
): Promise<string | undefined> {
  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (!visibility) return requestedAccountId;

  const service = createServiceClient();
  const { data: accounts } = await service
    .from("whatsapp_accounts")
    .select("id, assigned_to, created_at, health_status")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  const accessible = (accounts ?? []).filter((account) =>
    account.health_status !== "offline" && canAccessConversationAccount(account.id, visibility),
  );
  if (requestedAccountId) {
    if (!accessible.some((account) => account.id === requestedAccountId)) {
      throw new Error("Sem acesso a esta conta do WhatsApp");
    }
    return requestedAccountId;
  }
  return accessible.find((account) => account.assigned_to === ctx.userId)?.id ?? accessible[0]?.id;
}

export async function sendChatMessage(input: {
  leadId: string;
  body: string;
  accountId?: string;
  replyToMessageId?: string | null;
  quickMessageId?: string;
}): Promise<ChatSendActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  let accountId: string | undefined;

  try {
    accountId = await resolveAccessibleAccountId(ctx, input.accountId);
    const result = await sendChatMessageCore(supabase, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      leadId: input.leadId,
      body: input.body,
      accountId,
      replyToMessageId: input.replyToMessageId,
      quickMessageId: input.quickMessageId,
    });
    if (accountId) {
      void recordAccountHealthHeartbeat(createServiceClient(), accountId, "healthy");
    }
    revalidatePath("/chat");
    return { ok: true, ...result };
  } catch (e) {
    if (accountId) {
      const message = e instanceof Error ? e.message : String(e);
      const status = /connection closed|conexão.*fechada|not connected|disconnected/i.test(message)
        ? "offline"
        : "warning";
      void recordAccountHealthHeartbeat(createServiceClient(), accountId, status, publicSendError(e));
    }
    console.error("[chat] Falha ao enviar mensagem", {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: publicSendError(e) };
  }
}

function instagramApiError(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const data = raw as Record<string, unknown>;
    const error = data.error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string") return message;
    }
    const message = data.message;
    if (typeof message === "string") return message;
  }
  return "Falha ao enviar mensagem pelo Instagram";
}

export async function sendInstagramMessage(input: {
  leadId: string;
  body: string;
}): Promise<{ conversationId: string; message: ChatMessage }> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const body = input.body.trim();
  if (!body) throw new Error("Escreva uma mensagem");

  const { data: lead } = await supabase
    .from("leads")
    .select("id, instagram_sender_id")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  const senderId = (lead as { instagram_sender_id?: string | null } | null)?.instagram_sender_id;
  if (!lead || !senderId) throw new Error("Lead sem identificador do Instagram");

  const { data: account } = await supabase
    .from("instagram_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!account) throw new Error("Configure uma conta Instagram em /integrations/instagram");

  let conversationId: string | undefined;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", input.leadId)
    .eq("channel", "instagram")
    .maybeSingle();

  if (conv?.id) {
    conversationId = conv.id;
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        tenant_id: ctx.tenantId,
        lead_id: input.leadId,
        channel: "instagram",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversationId = created?.id;
  }
  if (!conversationId) throw new Error("Falha ao criar conversa");

  const { data: pendingMsg } = await supabase
    .from("messages")
    .insert({
      tenant_id: ctx.tenantId,
      conversation_id: conversationId,
      user_id: ctx.userId,
      direction: "outbound",
      body,
      status: "pending",
    })
    .select("id")
    .single();

  const row = account as {
    page_access_token?: string | null;
    page_id?: string | null;
    instagram_business_account_id?: string | null;
  };
  const accessToken = row.page_access_token;
  const igUserId = row.instagram_business_account_id || row.page_id;
  if (!accessToken || !igUserId) {
    await supabase
      .from("messages")
      .update({ status: "failed", error: "Credenciais Instagram incompletas" })
      .eq("id", pendingMsg!.id);
    throw new Error("Credenciais Instagram incompletas");
  }

  try {
    const res = await fetch(`https://graph.instagram.com/v25.0/${encodeURIComponent(igUserId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: { text: body },
      }),
    });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      const errMsg = instagramApiError(raw);
      await supabase.from("messages").update({ status: "failed", error: errMsg }).eq("id", pendingMsg!.id);
      throw new Error(errMsg);
    }

    const externalId =
      raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).message_id === "string"
        ? ((raw as Record<string, unknown>).message_id as string)
        : null;

    const { data: sentRow } = await supabase
      .from("messages")
      .update({ status: "sent", external_id: externalId })
      .eq("id", pendingMsg!.id)
      .select("id, body, direction, created_at, status")
      .single();
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        status: "em_atendimento",
      })
      .eq("id", conversationId);

    revalidatePath("/chat");

    return {
      conversationId,
      message: (sentRow ?? {
        id: pendingMsg!.id,
        body,
        direction: "outbound",
        created_at: new Date().toISOString(),
        status: "sent",
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

type MediaKind = "image" | "video" | "audio" | "document";

export async function sendChatMedia(input: {
  leadId: string;
  mediaUrl: string;
  mediaKind: MediaKind;
  fileName?: string;
  mimeType?: string;
  caption?: string;
  accountId?: string;
  quickMessageId?: string;
}): Promise<ChatSendActionResult> {
  const ctx = await requireContext();
  const supabase = await createClient();
  let accountId: string | undefined;

  try {
    accountId = await resolveAccessibleAccountId(ctx, input.accountId);
    const result = await sendChatMediaCore(supabase, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      ...input,
      accountId,
    });
    if (accountId) {
      void recordAccountHealthHeartbeat(createServiceClient(), accountId, "healthy");
    }
    revalidatePath("/chat");
    return { ok: true, ...result };
  } catch (e) {
    if (accountId) {
      const message = e instanceof Error ? e.message : String(e);
      const status = /connection closed|conexão.*fechada|not connected|disconnected/i.test(message)
        ? "offline"
        : "warning";
      void recordAccountHealthHeartbeat(createServiceClient(), accountId, status, publicSendError(e));
    }
    console.error("[chat] Falha ao enviar mídia", {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, error: publicSendError(e) };
  }
}

type MessageMutationContext = {
  message: {
    id: string;
    conversation_id: string;
    external_id: string;
    body: string | null;
    direction: "inbound" | "outbound";
    media_url: string | null;
    media_type: string | null;
    deleted_at: string | null;
    remote_phone: string | null;
  };
  conversation: {
    id: string;
    lead_id: string;
    whatsapp_account_id: string;
  };
  account: WhatsAppAccount;
  leadPhone: string;
};

async function loadMessageMutationContext(
  messageId: string,
  ctx: Awaited<ReturnType<typeof requireContext>>,
): Promise<MessageMutationContext> {
  const service = createServiceClient();
  const { data: messageData, error: messageError } = await service
    .from("messages")
    .select("id, conversation_id, external_id, body, direction, media_url, media_type, deleted_at, remote_phone")
    .eq("id", messageId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (messageError) throw new Error(messageError.message);

  const message = messageData as MessageMutationContext["message"] | null;
  if (!message) throw new Error("Mensagem nao encontrada");
  if (message.direction !== "outbound") throw new Error("Somente mensagens enviadas podem ser alteradas");
  if (!message.external_id?.trim()) throw new Error("Esta mensagem ainda nao possui identificador do WhatsApp");
  if (message.deleted_at) throw new Error("Esta mensagem ja foi apagada");

  const { data: conversationData, error: conversationError } = await service
    .from("conversations")
    .select("id, lead_id, channel, whatsapp_account_id")
    .eq("id", message.conversation_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (conversationError) throw new Error(conversationError.message);

  const conversationRow = conversationData as {
    id: string;
    lead_id: string;
    channel: string;
    whatsapp_account_id: string | null;
  } | null;
  if (!conversationRow || conversationRow.channel !== "whatsapp") {
    throw new Error("Edicao e exclusao estao disponiveis somente no WhatsApp");
  }

  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (!canAccessConversationAccount(conversationRow.whatsapp_account_id, visibility)) {
    throw new Error("Sem acesso a esta conversa");
  }
  if (!conversationRow.whatsapp_account_id) {
    throw new Error("A conversa nao esta vinculada a uma conta do WhatsApp");
  }

  const [{ data: accountData, error: accountError }, { data: leadData, error: leadError }] = await Promise.all([
    service
      .from("whatsapp_accounts")
      .select("*")
      .eq("id", conversationRow.whatsapp_account_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    service
      .from("leads")
      .select("phone")
      .eq("id", conversationRow.lead_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
  ]);
  if (accountError) throw new Error(accountError.message);
  if (leadError) throw new Error(leadError.message);
  const account = accountData as WhatsAppAccount | null;
  const leadPhone = (message.remote_phone?.trim() || (leadData as { phone?: string | null } | null)?.phone?.trim());
  if (!account) throw new Error("Conta do WhatsApp nao encontrada");
  if (!leadPhone) throw new Error("O lead nao possui telefone valido para alterar a mensagem");

  return {
    message: { ...message, external_id: message.external_id.trim() },
    conversation: {
      id: conversationRow.id,
      lead_id: conversationRow.lead_id,
      whatsapp_account_id: conversationRow.whatsapp_account_id,
    },
    account,
    leadPhone,
  };
}

export async function editChatMessage(input: {
  messageId: string;
  body: string;
}): Promise<{ id: string; body: string; edited_at: string }> {
  const ctx = await requireContext();
  const body = input.body.trim();
  if (!body) throw new Error("Escreva o novo texto da mensagem");
  if (body.length > 4_096) throw new Error("A mensagem pode ter no maximo 4.096 caracteres");

  const mutation = await loadMessageMutationContext(input.messageId, ctx);
  if (mutation.message.media_url || mutation.message.media_type) {
    throw new Error("Somente mensagens de texto podem ser editadas");
  }
  if (body === mutation.message.body?.trim()) {
    throw new Error("O texto novo e igual ao atual");
  }

  const provider = createProvider(mutation.account);
  if (!provider.editMessage) {
    throw new Error("Esta conta do WhatsApp nao permite editar mensagens pelo CRM");
  }
  await provider.editMessage({
    to: mutation.leadPhone,
    externalId: mutation.message.external_id,
    body,
  });

  const editedAt = new Date().toISOString();
  const service = createServiceClient();
  const { data, error } = await service
    .from("messages")
    .update({ body, edited_at: editedAt })
    .eq("id", mutation.message.id)
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("A mensagem foi alterada no WhatsApp, mas nao foi atualizada no CRM");

  await logLeadActivity(service, {
    tenantId: ctx.tenantId,
    leadId: mutation.conversation.lead_id,
    userId: ctx.userId,
    kind: "message_edited",
    payload: { message_id: mutation.message.id },
  });
  revalidatePath(`/chat/${mutation.conversation.lead_id}`);
  revalidatePath("/chat");
  return { id: mutation.message.id, body, edited_at: editedAt };
}

export async function deleteChatMessage(input: {
  messageId: string;
}): Promise<{ id: string; deleted_at: string }> {
  const ctx = await requireContext();
  const mutation = await loadMessageMutationContext(input.messageId, ctx);
  const provider = createProvider(mutation.account);
  if (!provider.deleteMessage) {
    throw new Error("Esta conta do WhatsApp nao permite apagar mensagens pelo CRM");
  }
  await provider.deleteMessage({
    to: mutation.leadPhone,
    externalId: mutation.message.external_id,
    fromMe: true,
  });

  const deletedAt = new Date().toISOString();
  const service = createServiceClient();
  const { data, error } = await service
    .from("messages")
    .update({
      body: null,
      media_url: null,
      media_type: null,
      deleted_at: deletedAt,
    })
    .eq("id", mutation.message.id)
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("A mensagem foi apagada no WhatsApp, mas nao foi atualizada no CRM");

  await logLeadActivity(service, {
    tenantId: ctx.tenantId,
    leadId: mutation.conversation.lead_id,
    userId: ctx.userId,
    kind: "message_deleted",
    payload: { message_id: mutation.message.id },
  });
  revalidatePath(`/chat/${mutation.conversation.lead_id}`);
  revalidatePath("/chat");
  return { id: mutation.message.id, deleted_at: deletedAt };
}

export async function scheduleChatMessage(input: {
  leadId: string;
  body: string;
  sendAt: string; // ISO
  mediaUrl?: string;
  mediaType?: string;
}): Promise<{ id: string }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const body = input.body.trim();
  const mediaUrl = input.mediaUrl?.trim() || null;
  if (!body && !mediaUrl) throw new Error("Escreva uma mensagem ou anexe um áudio");
  const when = new Date(input.sendAt);
  if (Number.isNaN(when.getTime())) throw new Error("Data inválida");
  if (when.getTime() < Date.now() - 60_000) throw new Error("Escolha um horário no futuro");

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead não encontrado");

  const { data, error } = await supabase
    .from("scheduled_messages")
    .insert({
      tenant_id: ctx.tenantId,
      lead_id: input.leadId,
      body: body || null,
      media_url: mediaUrl,
      media_type: mediaUrl ? input.mediaType ?? "audio" : null,
      send_at: when.toISOString(),
      status: "pending",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  void logLeadActivity(supabase, {
    tenantId: ctx.tenantId,
    leadId: input.leadId,
    userId: ctx.userId,
    kind: "message_scheduled",
    payload: { send_at: when.toISOString() },
  });

  revalidatePath(`/chat/${input.leadId}`);
  return { id: (data as { id: string }).id };
}

export async function listScheduledMessages(leadId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_messages")
    .select("id, body, media_url, media_type, send_at, status")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .order("send_at", { ascending: true });
  return (data ?? []) as {
    id: string;
    body: string | null;
    media_url: string | null;
    media_type: string | null;
    send_at: string;
    status: string;
  }[];
}

export async function cancelScheduledMessage(input: { id: string; leadId: string }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase
    .from("scheduled_messages")
    .update({ status: "cancelled" })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath(`/chat/${input.leadId}`);
}

const CLOSE_CHANNEL_PREFIX = "Fechado: ";

export async function updateChatLeadBusiness(input: {
  leadId: string;
  valueCents: number;
  pipelineId: string | null;
  stageId: string | null;
  assignedTo: string | null;
  lostReason?: string | null;
  lostPain?: string | null;
  closeChannel?: string | null;
  source?: string | null;
  creativeName?: string | null;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const valueCents = Math.max(0, Math.round(Number(input.valueCents) || 0));

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to, stage_id, won_at, tags, custom_fields")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");
  const currentLead = lead as {
    assigned_to: string | null;
    stage_id: string | null;
    won_at: string | null;
    tags: string[] | null;
    custom_fields: Record<string, unknown> | null;
  };

  // Origem e criativo sao editaveis o tempo todo (nao dependem de etapa) -
  // origem de onde o lead veio, criativo qual anuncio/peca especifica.
  const sourcePatch = input.source !== undefined ? { source: input.source?.trim() || null } : {};
  const customFieldsPatch =
    input.creativeName !== undefined
      ? {
          custom_fields: {
            ...(currentLead.custom_fields ?? {}),
            meta_creative_name: input.creativeName?.trim() || null,
          },
        }
      : {};

  let pipelineId = input.pipelineId;
  let stageId = input.stageId;
  // Marca/limpa won_at ao mover para (ou sair de) uma etapa de ganho.
  let wonAtPatch: { won_at: string | null } | null = null;
  // Motivo/dor da desistencia so fazem sentido numa etapa de perda; somem das demais.
  let lostReasonPatch: { lost_reason: string | null; lost_pain: string | null } | null = null;
  // Canal de fechamento vira uma tag "Fechado: X" - so faz sentido numa etapa
  // de ganho. Substitui qualquer tag de canal anterior (nao acumula).
  let tagsPatch: { tags: string[] } | null = null;
  if (stageId) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id, pipeline_id, is_won, is_lost")
      .eq("id", stageId)
      .eq("tenant_id", ctx.tenantId)
      .single();
    if (!stage) throw new Error("Etapa nao encontrada");
    pipelineId = stage.pipeline_id;
    const isWon = Boolean((stage as { is_won: boolean }).is_won);
    const isLost = Boolean((stage as { is_lost: boolean }).is_lost);
    if (isWon) {
      if (!currentLead.won_at || currentLead.stage_id !== stageId) {
        wonAtPatch = { won_at: new Date().toISOString() };
      }
      const withoutChannel = (currentLead.tags ?? []).filter((t) => !t.startsWith(CLOSE_CHANNEL_PREFIX));
      const channel = input.closeChannel?.trim();
      tagsPatch = { tags: channel ? [...withoutChannel, `${CLOSE_CHANNEL_PREFIX}${channel}`] : withoutChannel };
    } else {
      wonAtPatch = { won_at: null };
    }
    lostReasonPatch = {
      lost_reason: isLost ? (input.lostReason?.trim() || null) : null,
      lost_pain: isLost ? (input.lostPain?.trim() || null) : null,
    };
  } else {
    // Sem etapa: lead sai do pipeline, deixa de ser um ganho.
    wonAtPatch = { won_at: null };
    lostReasonPatch = { lost_reason: null, lost_pain: null };
  }
  if (pipelineId) {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("id", pipelineId)
      .eq("tenant_id", ctx.tenantId)
      .single();
    if (!pipeline) throw new Error("Funil nao encontrado");

    // Escolheu um funil mas nao uma etapa: cai na primeira etapa dele, para o
    // lead nunca "sumir" do kanban (que exige stage_id valido para exibir).
    if (!stageId) {
      const { data: firstStage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("pipeline_id", pipelineId)
        .order("position")
        .limit(1)
        .maybeSingle();
      stageId = (firstStage as { id: string } | null)?.id ?? null;
    }
  }

  if (input.assignedTo) {
    const { data: member } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", input.assignedTo)
      .maybeSingle();
    if (!member) throw new Error("Responsavel nao pertence a este workspace");
  }

  const { error } = await supabase
    .from("leads")
    .update({
      value_cents: valueCents,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: input.assignedTo,
      ...(wonAtPatch ?? {}),
      ...(lostReasonPatch ?? {}),
      ...(tagsPatch ?? {}),
      ...sourcePatch,
      ...customFieldsPatch,
    })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  if (wonAtPatch?.won_at) {
    const { notifyMetaLeadWon } = await import("@/lib/meta/notify-lead-won");
    void notifyMetaLeadWon(supabase, ctx.tenantId, input.leadId, valueCents);
  }

  if (currentLead.assigned_to !== input.assignedTo) {
    const { error: historyError } = await supabase.from("lead_assignment_history").insert({
      tenant_id: ctx.tenantId,
      lead_id: input.leadId,
      from_user_id: (lead as { assigned_to: string | null }).assigned_to,
      to_user_id: input.assignedTo,
      assigned_by: ctx.userId,
      reason: input.assignedTo ? "manual_assign" : "return_to_queue",
    });
    if (historyError) throw new Error(historyError.message);

    let toName: string | null = null;
    if (input.assignedTo) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", input.assignedTo)
        .maybeSingle();
      toName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
    }
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      userId: ctx.userId,
      kind: "assigned",
      payload: { to_user_name: toName, unassigned: !input.assignedTo },
    });

    // Avisa quem recebeu o lead.
    if (input.assignedTo && input.assignedTo !== ctx.userId) {
      const { data: leadRow } = await supabase
        .from("leads")
        .select("name")
        .eq("id", input.leadId)
        .maybeSingle();
      void notifyUser(supabase, {
        tenantId: ctx.tenantId,
        userId: input.assignedTo,
        kind: "lead_assigned",
        title: "Novo lead atribuido a voce",
        description: (leadRow as { name?: string } | null)?.name ?? "Um lead foi enviado para voce",
        link: `/leads/${input.leadId}`,
      });
    }
  }

  // Registra mudanca de etapa na linha do tempo do lead.
  if (stageId && stageId !== currentLead.stage_id) {
    const { data: toStage } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("id", stageId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    let fromName: string | null = null;
    if (currentLead.stage_id) {
      const { data: fromStage } = await supabase
        .from("pipeline_stages")
        .select("name")
        .eq("id", currentLead.stage_id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      fromName = (fromStage as { name?: string | null } | null)?.name ?? null;
    }
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      userId: ctx.userId,
      kind: "stage_changed",
      payload: { from_stage_name: fromName, to_stage_name: (toStage as { name?: string | null } | null)?.name ?? null },
    });
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  revalidatePath("/kanban");

  return { tags: tagsPatch?.tags ?? currentLead.tags ?? [] };
}

export async function updateChatLeadTags(input: { leadId: string; tags: string[] }) {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Normaliza: trim, remove vazios/duplicados, limita tamanho.
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.tags) {
    const t = String(raw).trim().slice(0, 40);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(t);
    if (tags.length >= 20) break;
  }

  const { data: before } = await supabase
    .from("leads")
    .select("tags")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  const prevTags = ((before as { tags?: string[] } | null)?.tags ?? []).map((t) => t.toLowerCase());

  const { error } = await supabase
    .from("leads")
    .update({ tags })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  const added = tags.filter((t) => !prevTags.includes(t.toLowerCase()));
  const removed = ((before as { tags?: string[] } | null)?.tags ?? []).filter(
    (t) => !tags.some((n) => n.toLowerCase() === t.toLowerCase()),
  );
  for (const tag of added) {
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      userId: ctx.userId,
      kind: "tag_added",
      payload: { tag },
    });
  }
  for (const tag of removed) {
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: input.leadId,
      userId: ctx.userId,
      kind: "tag_removed",
      payload: { tag },
    });
  }

  revalidatePath("/chat");
  revalidatePath(`/chat/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  return { tags };
}

export async function listLeadTagCatalog() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_tag_catalog")
    .select("name")
    .eq("tenant_id", ctx.tenantId)
    .order("normalized_name", { ascending: true })
    .limit(500);

  if (error) throw new Error("Não foi possível carregar as tags cadastradas.");
  return (data ?? []).map((tag) => tag.name);
}

export async function updateChatLeadNotes(input: { leadId: string; notes: string }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const notes = String(input.notes ?? "").slice(0, 20_000);

  const { data, error } = await supabase
    .from("leads")
    .update({ notes })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .select("notes")
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nao foi possivel salvar as notas deste lead.");

  revalidatePath("/chat");
  revalidatePath(`/chat/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  return { notes: data.notes ?? "" };
}

/**
 * Editar nome/email/telefone e empresa/CNPJ do lead direto do chat. Telefone
 * e o numero usado pra mandar WhatsApp - mudar aqui muda pra onde a proxima
 * mensagem sai, entao normaliza igual a qualquer outro numero do sistema.
 */
export async function updateChatLeadProfile(input: {
  leadId: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  companyCnpj: string | null;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const name = input.name.trim();
  if (!name) throw new Error("Nome nao pode ficar vazio");
  const phone = input.phone?.trim() ? normalizePhone(input.phone.trim()) : null;
  const cnpjDigits = input.companyCnpj?.replace(/\D/g, "") ?? "";
  if (cnpjDigits && cnpjDigits.length !== 14) throw new Error("CNPJ precisa ter 14 digitos");

  const { data: lead } = await supabase
    .from("leads")
    .select("custom_fields")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");

  const { error } = await supabase
    .from("leads")
    .update({
      name,
      email: input.email?.trim() || null,
      phone,
      custom_fields: {
        ...((lead as { custom_fields: Record<string, unknown> | null }).custom_fields ?? {}),
        company_name: input.companyName?.trim() || null,
        company_cnpj: cnpjDigits || null,
      },
    })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/chat");
  revalidatePath(`/chat/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  return { name, email: input.email?.trim() || null, phone };
}

/**
 * Sinal recebido / forma de pagamento - guardado em custom_fields (mesmo
 * padrao ja usado por meta_creative_name) pra nao precisar de migration.
 * Valor a receber nao e salvo: e sempre value_cents - collectedCents,
 * calculado na hora de exibir.
 */
export async function updateChatLeadPayment(input: {
  leadId: string;
  collectedCents: number;
  paymentMethod: string | null;
  paymentInstallments: number | null;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const collectedCents = Math.max(0, Math.round(Number(input.collectedCents) || 0));

  const { data: lead } = await supabase
    .from("leads")
    .select("custom_fields")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");

  const { error } = await supabase
    .from("leads")
    .update({
      custom_fields: {
        ...((lead as { custom_fields: Record<string, unknown> | null }).custom_fields ?? {}),
        payment_collected_cents: collectedCents,
        payment_method: input.paymentMethod?.trim() || null,
        payment_installments: input.paymentInstallments || null,
      },
    })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/chat");
  revalidatePath(`/chat/${input.leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/leads/${input.leadId}`);
  return { collectedCents, paymentMethod: input.paymentMethod, paymentInstallments: input.paymentInstallments };
}

export async function setLeadAutomations(input: { leadId: string; enabled: boolean }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ automations_enabled: input.enabled })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/chat/${input.leadId}`);
}

/** Clicar num numero de telefone dentro do texto de uma mensagem (igual o
 * WhatsApp faz) abre a conversa daquele numero - cria um lead novo se ainda
 * nao existir, do jeito que o WhatsApp abriria um chat novo. */
export async function openLeadByPhone(rawPhone: string): Promise<{ leadId: string }> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error("Numero invalido");

  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return { leadId: existing.id };

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_default", true)
    .single();
  const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
    ?.pipeline_stages?.sort((a, b) => a.position - b.position);

  const { data: created, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: ctx.tenantId,
      name: phone,
      phone,
      source: "manual",
      stage_id: stages?.[0]?.id,
      pipeline_id: (pipeline as { id?: string } | null)?.id,
      assigned_to: ctx.role === "vendedor" ? ctx.userId : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/leads");
  return { leadId: created.id };
}

export async function markConversationRead(conversationId: string) {
  const ctx = await requireContext();
  const supabase = createServiceClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, whatsapp_account_id, unread_count")
    .eq("id", conversationId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (conversationError) throw new Error(conversationError.message);
  if (!conversation) return;

  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (!canAccessConversationAccount(conversation.whatsapp_account_id, visibility)) {
    throw new Error("Sem acesso a esta conversa");
  }
  if ((conversation.unread_count ?? 0) === 0) return;

  // Abrir/ler a conversa apenas zera o nao-lido. NAO muda o status: so sai de
  // "aguardando" quando o atendente de fato responde (ver sendChatMessage).
  const { error } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

const VALID_STATUSES = ["nao_iniciada", "aguardando", "em_atendimento", "resolvida"] as const;
type ConvStatus = (typeof VALID_STATUSES)[number];

export async function setConversationStatus(input: { conversationId: string; status: ConvStatus }) {
  if (!VALID_STATUSES.includes(input.status)) throw new Error("Status inválido");
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status: input.status })
    .eq("id", input.conversationId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

/** Define o status pelo lead (usado no header do chat, que conhece o leadId). */
export async function setConversationStatusByLead(input: { leadId: string; status: ConvStatus }) {
  if (!VALID_STATUSES.includes(input.status)) throw new Error("Status inválido");
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status: input.status })
    .eq("lead_id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .eq("channel", "whatsapp");
  if (error) throw new Error(error.message);
  revalidatePath(`/chat/${input.leadId}`);
  revalidatePath("/chat");
}

/** Fixa ou desafixa uma conversa no topo da lista do tenant. */
export async function setConversationPinned(input: { conversationId: string; pinned: boolean }) {
  const ctx = await requireContext();
  const service = createServiceClient();
  const { data: conversation, error: conversationError } = await service
    .from("conversations")
    .select("id, whatsapp_account_id")
    .eq("id", input.conversationId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (conversationError) throw new Error(conversationError.message);
  if (!conversation) throw new Error("Conversa nao encontrada");

  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (!canAccessConversationAccount(conversation.whatsapp_account_id, visibility)) {
    throw new Error("Sem acesso a esta conversa");
  }

  const { error } = await service
    .from("conversations")
    .update({ pinned_at: input.pinned ? new Date().toISOString() : null })
    .eq("id", input.conversationId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

export type LeadTimelineEntry = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  userId: string | null;
  userName: string | null;
  createdAt: string;
};

export async function listLeadTimeline(leadId: string): Promise<LeadTimelineEntry[]> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_activities")
    .select("id, kind, payload, user_id, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as { id: string; kind: string; payload: Record<string, unknown> | null; user_id: string | null; created_at: string }[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v))));
  const namesByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const profile of profiles ?? []) {
      if (profile.full_name) namesByUser.set(profile.id, profile.full_name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload ?? {},
    userId: r.user_id,
    userName: r.user_id ? namesByUser.get(r.user_id) ?? null : null,
    createdAt: r.created_at,
  }));
}

/**
 * Thread compacta pra painel flutuante (kanban/ligacoes) - so o essencial
 * pra ler e responder, sem carregar a pagina inteira de chat.
 */
export async function getLeadChatThread(leadId: string): Promise<{
  conversationId: string | null;
  messages: ChatMessage[];
}> {
  const ctx = await requireContext();
  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", leadId)
    .eq("channel", "whatsapp")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!conv) return { conversationId: null, messages: [] };

  const { data } = await supabase
    .from("messages")
    .select("id, external_id, body, direction, created_at, status, media_url, media_type, user_id, edited_at, deleted_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return {
    conversationId: conv.id,
    messages: ((data ?? []) as ChatMessage[]).map((m) => ({ ...m, direction: m.direction })),
  };
}
