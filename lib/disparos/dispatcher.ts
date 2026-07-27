import { createServiceClient } from "@/lib/supabase/server";
import { sendChatMessageCore } from "@/lib/chat/send-message-core";
import { sendChatMediaCore } from "@/lib/chat/send-media-core";
import { renderMessageTemplate } from "@/lib/disparos/template";
import type { MediaKind } from "@/lib/whatsapp/provider";

// Loop assincrono em memoria, um processo Node persistente na VPS (nao
// serverless) - evita depender de um cron externo incerto pra dar conta de
// um intervalo entre envios da ordem de segundos. `running` evita iniciar o
// mesmo dispatch duas vezes (dupla aba, clique duplo, retomada + inicio).
const running = new Set<string>();

export function isCampaignRunning(campaignId: string): boolean {
  return running.has(campaignId);
}

export function startCampaignDispatch(campaignId: string): void {
  if (running.has(campaignId)) return;
  running.add(campaignId);
  void runDispatchLoop(campaignId).finally(() => running.delete(campaignId));
}

async function runDispatchLoop(campaignId: string): Promise<void> {
  const supabase = createServiceClient();

  for (;;) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, tenant_id, status, message_mode, body_text, quick_message_id, delay_seconds, created_by")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign || campaign.status === "cancelled") return;

    const { data: recipient } = await supabase
      .from("campaign_recipients")
      .select("id, lead_id, phone")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!recipient) {
      await supabase
        .from("campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", campaignId);
      return;
    }

    try {
      await sendToRecipient(supabase, campaign, recipient.lead_id);
      await supabase
        .from("campaign_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
    } catch (err) {
      await supabase
        .from("campaign_recipients")
        .update({ status: "failed", error: (err as Error).message })
        .eq("id", recipient.id);
    }

    await sleep(Math.max(1, campaign.delay_seconds) * 1000);
  }
}

type CampaignRow = {
  tenant_id: string;
  message_mode: string;
  body_text: string | null;
  quick_message_id: string | null;
  created_by: string | null;
};

async function sendToRecipient(
  supabase: ReturnType<typeof createServiceClient>,
  campaign: CampaignRow,
  leadId: string,
): Promise<void> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, phone, email, source")
    .eq("id", leadId)
    .eq("tenant_id", campaign.tenant_id)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");

  if (campaign.message_mode === "quick_message" && campaign.quick_message_id) {
    const { data: quickMessage } = await supabase
      .from("quick_messages")
      .select("body, media_url, media_type")
      .eq("id", campaign.quick_message_id)
      .eq("tenant_id", campaign.tenant_id)
      .single();
    if (!quickMessage) throw new Error("Mensagem rapida nao encontrada");

    if (quickMessage.media_url) {
      await sendChatMediaCore(supabase, {
        tenantId: campaign.tenant_id,
        userId: campaign.created_by,
        leadId,
        mediaUrl: quickMessage.media_url,
        mediaKind: (quickMessage.media_type ?? "document") as MediaKind,
        caption: quickMessage.body ? renderMessageTemplate(quickMessage.body, lead) : undefined,
      });
      return;
    }

    const body = renderMessageTemplate(quickMessage.body ?? "", lead);
    await sendChatMessageCore(supabase, { tenantId: campaign.tenant_id, userId: campaign.created_by, leadId, body });
    return;
  }

  const body = renderMessageTemplate(campaign.body_text ?? "", lead);
  await sendChatMessageCore(supabase, { tenantId: campaign.tenant_id, userId: campaign.created_by, leadId, body });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retoma campanhas "running" sem loop ativo na memoria (ex: apos deploy/restart). */
export async function resumeRunningCampaigns(tenantId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "running");
  for (const campaign of campaigns ?? []) {
    if (!isCampaignRunning(campaign.id)) startCampaignDispatch(campaign.id);
  }
}
