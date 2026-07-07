import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { findOrCreateInstagramLead } from "@/lib/instagram/find-or-create";

export const dynamic = "force-dynamic";

// Meta webhook verification (GET)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type InstagramMessagingEntry = {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: Array<{ type: string; payload: { url?: string } }>;
  };
};

type InstagramWebhookPayload = {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: InstagramMessagingEntry[];
  }>;
};

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as InstagramWebhookPayload;

  if (payload.object !== "instagram") {
    return NextResponse.json({ ok: false, reason: "not instagram" }, { status: 200 });
  }

  const supabase = createServiceClient();

  for (const entry of payload.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (!event.message) continue;

      const candidateIds = [...new Set([entry.id, event.recipient?.id].filter(Boolean))];
      if (candidateIds.length === 0) continue;

      let { data: account } = await supabase
        .from("instagram_accounts")
        .select("*")
        .in("page_id", candidateIds)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!account) {
        const res = await supabase
          .from("instagram_accounts")
          .select("*")
          .in("instagram_business_account_id", candidateIds)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        account = res.data;
      }

      if (!account) continue;

      const tenantId = account.tenant_id as string;
      const senderId = event.sender.id;
      const externalId = event.message.mid;
      const body = event.message.text ?? null;
      const attachment = event.message.attachments?.[0];
      const mediaUrl = attachment?.payload?.url ?? null;
      const mediaType = attachment?.type ?? null;
      const messageAt = new Date(event.timestamp).toISOString();

      // Deduplicate
      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("external_id", externalId)
        .maybeSingle();

      if (existing) continue;

      // Find default pipeline stage
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id, pipeline_stages(id, position)")
        .eq("tenant_id", tenantId)
        .eq("is_default", true)
        .single();

      const stages = (
        pipeline as { pipeline_stages?: { id: string; position: number }[] } | null
      )?.pipeline_stages?.sort((a, b) => a.position - b.position);

      const leadId = await findOrCreateInstagramLead(supabase, tenantId, {
        senderId,
        stageId: stages?.[0]?.id,
        pipelineId: (pipeline as { id?: string } | null)?.id,
      });

      if (!leadId) continue;

      // Upsert conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id, unread_count")
        .eq("tenant_id", tenantId)
        .eq("lead_id", leadId)
        .eq("channel", "instagram")
        .maybeSingle();

      let conversationId = existingConv?.id as string | undefined;

      if (!conversationId) {
        const { data: created } = await supabase
          .from("conversations")
          .insert({
            tenant_id: tenantId,
            lead_id: leadId,
            channel: "instagram",
            last_message_at: messageAt,
            unread_count: 1,
            status: "aguardando",
          })
          .select("id")
          .single();
        conversationId = created?.id;
      } else {
        const unread = (existingConv as { unread_count?: number }).unread_count ?? 0;
        await supabase
          .from("conversations")
          .update({ last_message_at: messageAt, unread_count: unread + 1, status: "aguardando" })
          .eq("id", conversationId);
      }

      if (!conversationId) continue;

      await supabase.from("messages").insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        direction: "inbound",
        body,
        media_url: mediaUrl,
        media_type: mediaType,
        external_id: externalId,
        status: "delivered",
        created_at: messageAt,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
