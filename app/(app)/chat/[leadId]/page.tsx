import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { getBlockedWhatsappAccountIds } from "@/lib/chat/list-conversation-items";
import { displayLeadName } from "@/lib/leads/display";
import { getCachedWhatsAppProfilePicture } from "@/lib/whatsapp/profile-picture";
import { fetchApi4comCalls } from "@/lib/integrations/api4com";
import { listQuickMessages } from "@/app/(app)/settings/quick-messages-actions";
import type { ConversationStatus } from "@/lib/chat/types";
import { ChatThread } from "./chat-thread";

export default async function ChatThreadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const ctx = await requireContext();
  const service = createServiceClient();

  const [
    leadRes,
    convoRes,
    quickMessages,
    professionalsRes,
    servicesRes,
    whatsappAccountsRes,
    pipelinesRes,
    scheduledMessagesRes,
    users,
    api4comCalls,
  ] = await Promise.all([
    service
      .from("leads")
      .select("id, name, phone, email, source, notes, tags, value_cents, created_at, assigned_to, pipeline_id, stage_id, automations_enabled, custom_fields, quality_stars, lost_reason")
      .eq("id", leadId)
      .eq("tenant_id", ctx.tenantId)
      .single(),
    service
      .from("conversations")
      .select("id, status, channel, whatsapp_account_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", leadId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    listQuickMessages(),
    service
      .from("professionals")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
    service
      .from("services")
      .select("id, name, duration_minutes")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
    service
      .from("whatsapp_accounts")
      .select("id, phone_number, display_name, provider, assigned_to")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("created_at"),
    service
      .from("pipelines")
      .select("id, name, pipeline_stages(id, name, color, position, is_lost)")
      .eq("tenant_id", ctx.tenantId)
      .order("name"),
    service
      .from("scheduled_messages")
      .select("id, body, media_url, media_type, send_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .order("send_at", { ascending: true }),
    listTenantUserOptions(ctx.tenantId),
    ctx.tenant.calls_dashboard_enabled ? fetchApi4comCalls() : Promise.resolve([]),
  ]);

  const lead = leadRes.data as {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    notes: string | null;
    tags: string[] | null;
    value_cents: number | null;
    created_at: string;
    assigned_to: string | null;
    pipeline_id: string | null;
    stage_id: string | null;
    automations_enabled: boolean | null;
    custom_fields: Record<string, unknown> | null;
    quality_stars: number | null;
    lost_reason: string | null;
  } | null;
  if (!lead) notFound();

  const convo = convoRes.data as { id: string; status: string | null; channel: string | null; whatsapp_account_id: string | null } | null;

  const blockedAccountIds = await getBlockedWhatsappAccountIds(ctx.tenantId, ctx.userId, ctx.role);
  if (blockedAccountIds && convo?.whatsapp_account_id && blockedAccountIds.includes(convo.whatsapp_account_id)) {
    notFound();
  }
  const leadPhoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  const recentCalls = api4comCalls
    .filter((call) => {
      const meta = call.metadata as Record<string, unknown> | null;
      if (meta?.tenant_id !== ctx.tenantId) return false;
      if (meta?.lead_id === leadId) return true;
      const to = call.to.replace(/\D/g, "");
      return Boolean(leadPhoneDigits && (to.endsWith(leadPhoneDigits) || leadPhoneDigits.endsWith(to)));
    })
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, 5)
    .map((call) => ({
      id: call.id,
      started_at: call.started_at,
      from: call.from,
      to: call.to,
      duration: call.duration,
      hangup_cause: call.hangup_cause,
      record_url: call.record_url,
    }));

  const [stageRes, pipelineRes, assigneeRes, appointmentRes, openTasksRes] = await Promise.all([
    lead.stage_id
      ? service
          .from("pipeline_stages")
          .select("name, color")
          .eq("id", lead.stage_id)
          .eq("tenant_id", ctx.tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lead.pipeline_id
      ? service
          .from("pipelines")
          .select("name")
          .eq("id", lead.pipeline_id)
          .eq("tenant_id", ctx.tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    lead.assigned_to
      ? service
          .from("profiles")
          .select("full_name")
          .eq("id", lead.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    service
      .from("appointments")
      .select("starts_at, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", leadId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    service
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", leadId)
      .eq("status", "open"),
  ]);

  let messages: {
    id: string;
    body: string | null;
    direction: "inbound" | "outbound";
    created_at: string;
    status: string;
    media_url?: string | null;
    media_type?: string | null;
    user_id?: string | null;
    sender_name?: string | null;
  }[] = [];

  if (convo?.id) {
    const { data } = await service
      .from("messages")
      .select("id, external_id, body, direction, created_at, status, media_url, media_type, reply_to_message_id, reply_to_external_id, reply_to_body, reply_to_sender_name, user_id")
      .eq("conversation_id", convo.id)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(150);
    const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean) as string[])];
    const namesByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const profile of profiles ?? []) {
        if (profile.full_name) namesByUser.set(profile.id, profile.full_name);
      }
    }
    messages = [...(data ?? [])].reverse().map((row) => {
      const r = row as Record<string, unknown>;
      const userId = r.user_id as string | null;
      return {
        id: r.id as string,
        external_id: r.external_id as string | null,
        body: r.body as string | null,
        direction: r.direction as "inbound" | "outbound",
        created_at: r.created_at as string,
        status: r.status as string,
        media_url: r.media_url as string | null,
        media_type: r.media_type as string | null,
        reply_to_message_id: r.reply_to_message_id as string | null,
        reply_to_external_id: r.reply_to_external_id as string | null,
        reply_to_body: r.reply_to_body as string | null,
        reply_to_sender_name: r.reply_to_sender_name as string | null,
        user_id: userId,
        sender_name: userId ? (namesByUser.get(userId) ?? null) : null,
      };
    });
  }

  return (
    <ChatThread
      leadId={lead.id}
      tenantId={ctx.tenantId}
      leadName={displayLeadName(lead.name, lead.phone)}
      leadPhone={lead.phone ?? ""}
      leadAvatarUrl={getCachedWhatsAppProfilePicture(lead.custom_fields)}
      conversationId={convo?.id ?? null}
      conversationAccountId={(convo as { whatsapp_account_id?: string | null } | null)?.whatsapp_account_id ?? null}
      channel={(convo?.channel === "instagram" ? "instagram" : "whatsapp")}
      initialStatus={(convo?.status as ConversationStatus | null) ?? "nao_iniciada"}
      initialAutomationsEnabled={lead.automations_enabled ?? true}
      initialMessages={messages}
      currentUserId={ctx.userId}
      initialScheduledMessages={(scheduledMessagesRes.data ?? []) as {
        id: string;
        body: string | null;
        media_url: string | null;
        media_type: string | null;
        send_at: string;
      }[]}
      quickMessages={quickMessages}
      professionals={professionalsRes.data ?? []}
      users={users}
      services={(servicesRes.data ?? []) as { id: string; name: string; duration_minutes: number }[]}
      whatsappAccounts={((whatsappAccountsRes.data ?? []) as { id: string; phone_number: string; display_name: string | null; provider: string; assigned_to: string | null }[]).filter(
        (a) => !blockedAccountIds || !blockedAccountIds.includes(a.id),
      )}
      recentCalls={recentCalls}
      pipelineOptions={((pipelinesRes.data ?? []) as {
        id: string;
        name: string;
        pipeline_stages?: { id: string; name: string; color: string | null; position: number | null }[];
      }[]).map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        stages: [...(pipeline.pipeline_stages ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      }))}
      leadDetails={{
        pipelineId: lead.pipeline_id,
        stageId: lead.stage_id,
        assignedTo: lead.assigned_to,
        email: lead.email,
        source: lead.source,
        notes: lead.notes,
        tags: lead.tags ?? [],
        valueCents: lead.value_cents ?? 0,
        createdAt: lead.created_at,
        stageName: (stageRes.data as { name?: string } | null)?.name ?? null,
        stageColor: (stageRes.data as { color?: string | null } | null)?.color ?? null,
        pipelineName: (pipelineRes.data as { name?: string } | null)?.name ?? null,
        assignedName: (assigneeRes.data as { full_name?: string | null } | null)?.full_name ?? null,
        nextAppointmentAt: (appointmentRes.data as { starts_at?: string } | null)?.starts_at ?? null,
        openTasksCount: openTasksRes.count ?? 0,
        qualityStars: lead.quality_stars ?? 0,
        lostReason: lead.lost_reason,
      }}
    />
  );
}
