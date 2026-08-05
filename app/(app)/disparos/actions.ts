"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { startCampaignDispatch } from "@/lib/disparos/dispatcher";

export async function listBroadcastLeads() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const pageSize = 1000;
  const leads: Array<{
    id: string;
    name: string;
    phone: string | null;
    source: string | null;
    created_at: string;
  }> = [];

  // O Supabase limita a quantidade de linhas por resposta. Paginar evita
  // esconder contatos antigos ou uma importacao recente em tenants maiores.
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, phone, source, created_at")
      .eq("tenant_id", ctx.tenantId)
      .not("phone", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    leads.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return leads;
}

export async function listMessageTemplates() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("id, name, payload")
    .eq("tenant_id", ctx.tenantId)
    .order("name");
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, body: (t.payload as { body?: string })?.body ?? "" }));
}

export async function saveMessageTemplate(input: { id?: string; name: string; body: string }) {
  const ctx = await requireContext();
  if (!input.name.trim()) throw new Error("Informe o nome do modelo");
  if (!input.body.trim()) throw new Error("A mensagem do modelo esta vazia");

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase
      .from("message_templates")
      .update({ name: input.name.trim(), payload: { body: input.body } })
      .eq("id", input.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("message_templates")
      .insert({ tenant_id: ctx.tenantId, name: input.name.trim(), payload: { body: input.body } });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/disparos");
}

export async function deleteMessageTemplate(id: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("message_templates").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  revalidatePath("/disparos");
}

export async function startBroadcast(input: {
  messageMode: "text" | "quick_message";
  bodyText?: string;
  quickMessageId?: string;
  accountId?: string;
  delaySeconds: number;
  dailyCap?: number;
  businessHoursOnly?: boolean;
  leadIds: string[];
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.broadcast_enabled) throw new Error("Modulo de disparo desativado para esta empresa");
  if (input.leadIds.length === 0) throw new Error("Selecione ao menos um lead");
  if (input.messageMode === "text" && !input.bodyText?.trim()) throw new Error("Escreva a mensagem");
  if (input.messageMode === "quick_message" && !input.quickMessageId) throw new Error("Selecione a mensagem rapida");

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, phone")
    .eq("tenant_id", ctx.tenantId)
    .in("id", input.leadIds);

  const validLeads = (leads ?? []).filter((l) => l.phone);
  if (validLeads.length === 0) throw new Error("Nenhum lead selecionado tem telefone valido");

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      tenant_id: ctx.tenantId,
      name: `Disparo ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      status: "running",
      message_mode: input.messageMode,
      body_text: input.messageMode === "text" ? input.bodyText : null,
      quick_message_id: input.messageMode === "quick_message" ? input.quickMessageId : null,
      account_id: input.accountId || null,
      delay_seconds: Math.max(1, Math.round(input.delaySeconds || 10)),
      daily_cap: input.dailyCap && input.dailyCap > 0 ? Math.round(input.dailyCap) : null,
      business_hours_only: input.businessHoursOnly ?? true,
      started_at: new Date().toISOString(),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const rows = validLeads.map((l) => ({
    tenant_id: ctx.tenantId,
    campaign_id: campaign.id,
    lead_id: l.id,
    phone: l.phone as string,
  }));
  const { error: recipientsError } = await supabase.from("campaign_recipients").insert(rows);
  if (recipientsError) throw new Error(recipientsError.message);

  startCampaignDispatch(campaign.id);
  revalidatePath("/disparos");
  return { campaignId: campaign.id as string };
}

export async function cancelCampaign(campaignId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", campaignId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/disparos");
}

export async function getCampaignRecipients(campaignId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_recipients")
    .select("id, phone, status, error, sent_at, external_message_id, leads(name)")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });
  const recipients = (data ?? []) as Array<{
    id: string;
    phone: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    external_message_id: string | null;
    leads: { name: string } | null;
  }>;

  const externalIds = recipients.flatMap((recipient) =>
    recipient.external_message_id ? [recipient.external_message_id] : [],
  );
  const statuses = new Map<string, { status: string; error: string | null }>();
  for (let index = 0; index < externalIds.length; index += 200) {
    const { data: messages } = await supabase
      .from("messages")
      .select("external_id, status, error")
      .eq("tenant_id", ctx.tenantId)
      .in("external_id", externalIds.slice(index, index + 200));
    for (const message of messages ?? []) {
      if (message.external_id) statuses.set(message.external_id, { status: message.status, error: message.error });
    }
  }

  return recipients.map((recipient) => {
    const delivery = recipient.external_message_id ? statuses.get(recipient.external_message_id) : null;
    return {
      ...recipient,
      delivery_status: delivery?.status ?? null,
      delivery_error: delivery?.error ?? null,
    };
  });
}

export async function getLatestCampaign() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, status, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
