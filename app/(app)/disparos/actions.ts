"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { startCampaignDispatch } from "@/lib/disparos/dispatcher";

export async function searchLeadsForBroadcast(query: string) {
  const ctx = await requireContext();
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, phone")
    .eq("tenant_id", ctx.tenantId)
    .not("phone", "is", null)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(20);

  return data ?? [];
}

export async function createCampaign(input: {
  name: string;
  messageMode: "text" | "quick_message";
  bodyText?: string;
  quickMessageId?: string;
  delaySeconds: number;
  leadIds: string[];
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.broadcast_enabled) throw new Error("Modulo de disparo desativado para esta empresa");
  if (!input.name.trim()) throw new Error("Informe o nome da campanha");
  if (input.leadIds.length === 0) throw new Error("Selecione ao menos um destinatario");
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
      name: input.name.trim(),
      status: "running",
      message_mode: input.messageMode,
      body_text: input.messageMode === "text" ? input.bodyText : null,
      quick_message_id: input.messageMode === "quick_message" ? input.quickMessageId : null,
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
