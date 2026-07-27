"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { startCampaignDispatch } from "@/lib/disparos/dispatcher";

export async function listBroadcastLeads() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, phone")
    .eq("tenant_id", ctx.tenantId)
    .not("phone", "is", null)
    .order("name")
    .limit(500);
  return data ?? [];
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
      name: `Disparo ${new Date().toLocaleString("pt-BR")}`,
      status: "running",
      message_mode: input.messageMode,
      body_text: input.messageMode === "text" ? input.bodyText : null,
      quick_message_id: input.messageMode === "quick_message" ? input.quickMessageId : null,
      account_id: input.accountId || null,
      delay_seconds: Math.max(1, Math.round(input.delaySeconds || 10)),
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
    .select("id, phone, status, error, sent_at, leads(name)")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Array<{
    id: string;
    phone: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    leads: { name: string } | null;
  }>;
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
