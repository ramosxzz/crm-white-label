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

const LABEL_COLORS = ["#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706", "#0891b2"];

export async function sendChatMessage(input: {
  leadId: string;
  body: string;
  accountId?: string;
  replyToMessageId?: string | null;
  quickMessageId?: string;
}): Promise<{ conversationId: string; message: ChatMessage }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  try {
    const result = await sendChatMessageCore(supabase, {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      leadId: input.leadId,
      body: input.body,
      accountId: input.accountId,
      replyToMessageId: input.replyToMessageId,
      quickMessageId: input.quickMessageId,
    });
    revalidatePath("/chat");
    return result;
  } catch (e) {
    revalidatePath(`/chat/${input.leadId}`);
    throw e;
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
      .update({ last_message_at: new Date().toISOString(), status: "em_atendimento" })
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
}): Promise<{ conversationId: string; message: ChatMessage }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  try {
    const result = await sendChatMediaCore(supabase, { tenantId: ctx.tenantId, userId: ctx.userId, ...input });
    revalidatePath("/chat");
    return result;
  } catch (e) {
    revalidatePath(`/chat/${input.leadId}`);
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

export async function updateChatLeadBusiness(input: {
  leadId: string;
  valueCents: number;
  pipelineId: string | null;
  stageId: string | null;
  assignedTo: string | null;
  lostReason?: string | null;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const valueCents = Math.max(0, Math.round(Number(input.valueCents) || 0));

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to, stage_id, won_at")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");
  const currentLead = lead as { assigned_to: string | null; stage_id: string | null; won_at: string | null };

  let pipelineId = input.pipelineId;
  let stageId = input.stageId;
  // Marca/limpa won_at ao mover para (ou sair de) uma etapa de ganho.
  let wonAtPatch: { won_at: string | null } | null = null;
  // Motivo da desistencia so faz sentido numa etapa de perda; some das demais.
  let lostReasonPatch: { lost_reason: string | null } | null = null;
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
    } else {
      wonAtPatch = { won_at: null };
    }
    lostReasonPatch = { lost_reason: isLost ? (input.lostReason?.trim() || null) : null };
  } else {
    // Sem etapa: lead sai do pipeline, deixa de ser um ganho.
    wonAtPatch = { won_at: null };
    lostReasonPatch = { lost_reason: null };
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

  // Abrir/ler a conversa apenas zera o nao-lido. NAO muda o status: so sai de
  // "aguardando" quando o atendente de fato responde (ver sendChatMessage).
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
    .select("id, external_id, body, direction, created_at, status, media_url, media_type, user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return {
    conversationId: conv.id,
    messages: ((data ?? []) as ChatMessage[]).map((m) => ({ ...m, direction: m.direction })),
  };
}
