import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { displayLeadName } from "@/lib/leads/display";
import { getCachedWhatsAppProfilePicture } from "@/lib/whatsapp/profile-picture";
import { listQuickMessages } from "@/app/(app)/settings/quick-messages-actions";
import type { ConversationStatus } from "@/lib/chat/types";
import { ChatThread } from "./chat-thread";

export default async function ChatThreadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const ctx = await requireContext();
  const service = createServiceClient();

  const [leadRes, convoRes, quickMessages, professionalsRes, servicesRes, whatsappAccountsRes] = await Promise.all([
    service
      .from("leads")
      .select("id, name, phone, automations_enabled, custom_fields")
      .eq("id", leadId)
      .eq("tenant_id", ctx.tenantId)
      .single(),
    service
      .from("conversations")
      .select("id, status, channel")
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
      .select("id, phone_number, display_name, provider")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  const lead = leadRes.data as {
    id: string;
    name: string;
    phone: string | null;
    automations_enabled: boolean | null;
    custom_fields: Record<string, unknown> | null;
  } | null;
  if (!lead) notFound();

  const convo = convoRes.data as { id: string; status: string | null; channel: string | null } | null;

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
      .select("id, body, direction, created_at, status, media_url, media_type, user_id")
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
        body: r.body as string | null,
        direction: r.direction as "inbound" | "outbound",
        created_at: r.created_at as string,
        status: r.status as string,
        media_url: r.media_url as string | null,
        media_type: r.media_type as string | null,
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
      channel={(convo?.channel === "instagram" ? "instagram" : "whatsapp")}
      initialStatus={(convo?.status as ConversationStatus | null) ?? "nao_iniciada"}
      initialAutomationsEnabled={lead.automations_enabled ?? true}
      initialMessages={messages}
      quickMessages={quickMessages}
      professionals={professionalsRes.data ?? []}
      services={(servicesRes.data ?? []) as { id: string; name: string; duration_minutes: number }[]}
      whatsappAccounts={(whatsappAccountsRes.data ?? []) as { id: string; phone_number: string; display_name: string | null; provider: string }[]}
    />
  );
}
