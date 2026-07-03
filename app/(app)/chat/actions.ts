"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import type { ChatMessage } from "@/lib/chat/types";

const LABEL_COLORS = ["#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706", "#0891b2"];

function providerErrorMessage(result: { status: string; raw?: unknown }): string {
  if (result.raw && typeof result.raw === "object") {
    const r = result.raw as Record<string, unknown>;
    if (typeof r.error === "string") return r.error;
    if (typeof r.message === "string") return r.message;
  }
  return "Falha ao enviar mensagem pelo WhatsApp";
}

export async function sendChatMessage(input: {
  leadId: string;
  body: string;
  accountId?: string;
}): Promise<{ conversationId: string; message: ChatMessage }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, name")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead?.phone) throw new Error("Lead sem telefone");

  const to = normalizeWhatsAppPhone(lead.phone);
  if (to && to !== lead.phone.replace(/\D/g, "")) {
    await supabase.from("leads").update({ phone: to }).eq("id", lead.id).eq("tenant_id", ctx.tenantId);
  }

  let accountQuery = supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);
  if (input.accountId) {
    accountQuery = accountQuery.eq("id", input.accountId);
  }
  const { data: account } = await accountQuery.limit(1).single();

  let conversationId: string | undefined;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", lead.id)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (conv?.id) {
    conversationId = conv.id;
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        tenant_id: ctx.tenantId,
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

  const { data: pendingMsg } = await supabase
    .from("messages")
    .insert({
      tenant_id: ctx.tenantId,
      conversation_id: conversationId,
      user_id: ctx.userId,
      direction: "outbound",
      body: input.body,
      status: "pending",
    })
    .select("id")
    .single();

  if (!account) {
    await supabase
      .from("messages")
      .update({ status: "failed", error: "Nenhuma conta WhatsApp configurada" })
      .eq("id", pendingMsg!.id);
    revalidatePath(`/chat/${lead.id}`);
    throw new Error("Configure uma conta WhatsApp em /settings/whatsapp");
  }

  try {
    const provider = createProvider(account as WhatsAppAccount);
    const result = await provider.send({ to, body: input.body });
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
      .select("id, body, direction, created_at, status")
      .single();
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString(), status: "aguardando" })
      .eq("id", conversationId);

    revalidatePath(`/chat/${lead.id}`);
    revalidatePath("/chat");

    return {
      conversationId,
      message: (sentRow ?? {
        id: pendingMsg!.id,
        body: input.body,
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
}): Promise<{ conversationId: string; message: ChatMessage }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  if (!input.mediaUrl) throw new Error("Mídia ausente");

  const { data: lead } = await supabase
    .from("leads")
    .select("id, phone, name")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead?.phone) throw new Error("Lead sem telefone");

  const to = normalizeWhatsAppPhone(lead.phone) ?? lead.phone.replace(/\D/g, "");

  let mediaAccountQuery = supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true);
  if (input.accountId) {
    mediaAccountQuery = mediaAccountQuery.eq("id", input.accountId);
  }
  const { data: account } = await mediaAccountQuery.limit(1).single();

  // Encontra ou cria a conversa
  let conversationId: string | undefined;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", lead.id)
    .eq("channel", "whatsapp")
    .maybeSingle();

  if (conv?.id) {
    conversationId = conv.id;
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({
        tenant_id: ctx.tenantId,
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

  // Corpo de prévia por tipo
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
      tenant_id: ctx.tenantId,
      conversation_id: conversationId,
      user_id: ctx.userId,
      direction: "outbound",
      body: previewBody,
      media_url: input.mediaUrl,
      media_type: input.mediaKind,
      status: "pending",
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
      .update({ last_message_at: new Date().toISOString(), status: "aguardando" })
      .eq("id", conversationId);

    revalidatePath(`/chat/${lead.id}`);
    revalidatePath("/chat");

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

export async function markConversationRead(conversationId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId)
    .eq("tenant_id", ctx.tenantId);
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

export async function fetchGroupMessages(groupId: string): Promise<
  {
    id: string;
    externalId: string | null;
    direction: "inbound" | "outbound";
    body: string;
    senderName: string | null;
    senderJid: string | null;
    mediaUrl: string | null;
    mediaType: string | null;
    createdAt: string;
  }[]
> {
  const ctx = await requireContext();
  const supabase = createServiceClient();

  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("provider_group_id")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!group) return [];

  const { data: logs } = await supabase
    .from("whatsapp_webhook_logs")
    .select("id, from_me, payload, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("event_type", "GROUP_MESSAGE")
    .eq("contact_lid", (group as { provider_group_id: string }).provider_group_id)
    .order("created_at", { ascending: true })
    .limit(500);

  const txt = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  return (logs ?? []).map((log) => {
    const p = (log.payload && typeof log.payload === "object" && !Array.isArray(log.payload)
      ? log.payload
      : {}) as Record<string, unknown>;
    return {
      id: log.id as string,
      externalId: txt(p.external_id),
      direction: (p.direction === "outbound" || log.from_me ? "outbound" : "inbound") as
        | "inbound"
        | "outbound",
      body: txt(p.body) ?? "",
      senderName: txt(p.sender_name),
      senderJid: txt(p.sender_jid),
      mediaUrl: txt(p.media_url),
      mediaType: txt(p.media_type),
      createdAt: txt(p.message_at) ?? (log.created_at as string),
    };
  });
}

export async function addGroupLabel(input: { groupId: string; name: string }) {
  const ctx = await requireContext();
  const supabase = createServiceClient();
  const name = input.name.trim().slice(0, 32);
  if (!name) throw new Error("Informe o nome da label");

  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("id")
    .eq("id", input.groupId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!group) throw new Error("Grupo nao encontrado");

  const { data: existing } = await supabase
    .from("whatsapp_group_labels")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .ilike("name", name)
    .maybeSingle();

  let labelId = existing?.id as string | undefined;
  if (!labelId) {
    const color = LABEL_COLORS[Math.abs(name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % LABEL_COLORS.length];
    const { data: created, error } = await supabase
      .from("whatsapp_group_labels")
      .insert({ tenant_id: ctx.tenantId, name, color })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    labelId = created?.id;
  }

  if (!labelId) throw new Error("Falha ao criar label");

  const { error } = await supabase
    .from("whatsapp_group_label_assignments")
    .upsert(
      { tenant_id: ctx.tenantId, group_id: input.groupId, label_id: labelId },
      { onConflict: "group_id,label_id" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/chat");
}

export async function removeGroupLabel(input: { groupId: string; labelId: string }) {
  const ctx = await requireContext();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("whatsapp_group_label_assignments")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("group_id", input.groupId)
    .eq("label_id", input.labelId);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

function evolutionErrorMessage(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const data = raw as Record<string, unknown>;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
    const response = data.response;
    if (response && typeof response === "object") {
      const message = (response as Record<string, unknown>).message;
      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string") return message;
    }
  }
  return "Falha ao enviar mensagem no grupo";
}

async function sendEvolutionGroupMedia(
  account: WhatsAppAccount,
  groupJid: string,
  input: { mediaUrl: string; mediaKind: "image" | "video" | "audio" | "document"; caption?: string; fileName?: string; mimeType?: string },
) {
  const credentials = account.credentials as { base_url?: string; api_key?: string; instance?: string };
  const baseUrl = credentials.base_url?.replace(/\/$/, "");
  const apiKey = credentials.api_key;
  const instance = credentials.instance;
  if (!baseUrl || !apiKey || !instance) throw new Error("Credenciais Evolution incompletas");

  let url: string;
  let payload: Record<string, unknown>;
  if (input.mediaKind === "audio") {
    url = `${baseUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instance)}`;
    payload = { number: groupJid, audio: input.mediaUrl };
  } else {
    url = `${baseUrl}/message/sendMedia/${encodeURIComponent(instance)}`;
    payload = {
      number: groupJid,
      mediatype: input.mediaKind,
      media: input.mediaUrl,
      ...(input.caption ? { caption: input.caption } : {}),
      ...(input.fileName ? { fileName: input.fileName } : {}),
      ...(input.mimeType ? { mimetype: input.mimeType } : {}),
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let raw: unknown = text;
  try {
    raw = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  if (!res.ok) throw new Error(evolutionErrorMessage(raw));
  return raw as { key?: { id?: string }; messageTimestamp?: string | number };
}

export async function sendGroupMedia(input: {
  groupId: string;
  mediaUrl: string;
  mediaKind: "image" | "video" | "audio" | "document";
  fileName?: string;
  mimeType?: string;
  caption?: string;
}) {
  const ctx = await requireContext();
  const supabase = createServiceClient();
  if (!input.mediaUrl) throw new Error("Mídia ausente");

  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("id, provider_group_id")
    .eq("id", input.groupId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!group) throw new Error("Grupo nao encontrado");

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("provider", "evolution")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (!account) throw new Error("Conta Evolution nao configurada");

  const raw = await sendEvolutionGroupMedia(account as WhatsAppAccount, group.provider_group_id, input);
  const externalId = raw.key?.id ?? `group-media-${Date.now()}`;
  const messageAt = raw.messageTimestamp
    ? new Date(Number(raw.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString();

  const previewBody =
    input.caption?.trim() ||
    (input.mediaKind === "image" ? "📷 Imagem" : input.mediaKind === "video" ? "🎬 Vídeo" : input.mediaKind === "audio" ? "🎤 Áudio" : `📎 ${input.fileName ?? "Documento"}`);

  const { data: inserted } = await supabase
    .from("whatsapp_webhook_logs")
    .insert({
      tenant_id: ctx.tenantId,
      whatsapp_account_id: account.id,
      event_type: "GROUP_MESSAGE",
      from_me: true,
      contact_lid: group.provider_group_id,
      parsed_count: 1,
      payload: {
        external_id: externalId,
        provider_group_id: group.provider_group_id,
        sender_name: account.display_name ?? "Voce",
        direction: "outbound",
        body: previewBody,
        media_url: input.mediaUrl,
        media_type: input.mediaKind,
        message_at: messageAt,
      },
    })
    .select("id")
    .single();

  await supabase
    .from("whatsapp_groups")
    .update({ last_message_body: previewBody, last_message_direction: "outbound", last_message_at: messageAt, last_event_at: messageAt })
    .eq("id", group.id);

  revalidatePath(`/chat/groups/${input.groupId}`);

  return {
    id: inserted?.id ?? externalId,
    externalId,
    direction: "outbound" as const,
    body: previewBody,
    senderName: account.display_name ?? "Voce",
    senderJid: null,
    mediaUrl: input.mediaUrl,
    mediaType: input.mediaKind,
    createdAt: messageAt,
  };
}

async function sendEvolutionGroupText(account: WhatsAppAccount, groupJid: string, body: string) {
  const credentials = account.credentials as { base_url?: string; api_key?: string; instance?: string };
  const baseUrl = credentials.base_url?.replace(/\/$/, "");
  const apiKey = credentials.api_key;
  const instance = credentials.instance;
  if (!baseUrl || !apiKey || !instance) throw new Error("Credenciais Evolution incompletas");

  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`;
  const attempts = [
    { number: groupJid, text: body, linkPreview: true },
    { groupJid, text: body, linkPreview: true },
  ];

  let lastRaw: unknown = null;
  for (const payload of attempts) {
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let raw: unknown = text;
    try {
      raw = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    lastRaw = raw;
    if (res.ok) return raw as { key?: { id?: string; remoteJid?: string }; messageTimestamp?: string | number };
  }

  throw new Error(evolutionErrorMessage(lastRaw));
}

export async function sendGroupMessage(input: { groupId: string; body: string }) {
  const ctx = await requireContext();
  const supabase = createServiceClient();
  const body = input.body.trim();
  if (!body) throw new Error("Digite uma mensagem");

  const { data: group } = await supabase
    .from("whatsapp_groups")
    .select("id, tenant_id, whatsapp_account_id, provider_group_id")
    .eq("id", input.groupId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!group) throw new Error("Grupo nao encontrado");

  const { data: account } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("provider", "evolution")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (!account) throw new Error("Conta Evolution nao configurada");

  const raw = await sendEvolutionGroupText(account as WhatsAppAccount, group.provider_group_id, body);
  const externalId = raw.key?.id ?? `group-out-${Date.now()}`;
  const messageAt = raw.messageTimestamp
    ? new Date(Number(raw.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("whatsapp_webhook_logs")
    .insert({
      tenant_id: ctx.tenantId,
      whatsapp_account_id: account.id,
      event_type: "GROUP_MESSAGE",
      from_me: true,
      contact_lid: group.provider_group_id,
      parsed_count: 1,
      payload: {
        external_id: externalId,
        provider_group_id: group.provider_group_id,
        sender_jid: account.phone_number,
        sender_name: account.display_name ?? "Voce",
        direction: "outbound",
        body,
        message_at: messageAt,
        raw_payload: raw,
      },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("whatsapp_groups")
    .update({ last_message_body: body, last_message_direction: "outbound", last_message_at: messageAt, last_event_at: messageAt })
    .eq("id", group.id);

  revalidatePath(`/chat/groups/${input.groupId}`);
  revalidatePath("/chat");

  return {
    id: inserted?.id ?? externalId,
    direction: "outbound" as const,
    body,
    senderName: account.display_name ?? "Voce",
    senderJid: account.phone_number,
    createdAt: messageAt,
    externalId,
  };
}
