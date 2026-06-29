import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { displayLeadName } from "@/lib/leads/display";
import { listQuickMessages } from "@/app/(app)/settings/quick-messages-actions";
import type { ConversationStatus } from "@/lib/chat/types";
import { ChatThread } from "./chat-thread";

export default async function ChatThreadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const leadRes = await supabase
    .from("leads")
    .select("id, name, phone, automations_enabled")
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  const lead = leadRes.data as {
    id: string;
    name: string;
    phone: string | null;
    automations_enabled: boolean | null;
  } | null;
  if (!lead) notFound();

  const convoRes = await supabase
    .from("conversations")
    .select("id, status")
    .eq("tenant_id", ctx.tenantId)
    .eq("lead_id", leadId)
    .eq("channel", "whatsapp")
    .maybeSingle();

  const convo = convoRes.data as { id: string; status: string | null } | null;

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
    const { data } = await supabase
      .from("messages")
      .select("id, body, direction, created_at, status, media_url, media_type, user_id, profiles:user_id(full_name)")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true })
      .limit(500);
    messages = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const profile = r.profiles as { full_name?: string | null } | null;
      return {
        id: r.id as string,
        body: r.body as string | null,
        direction: r.direction as "inbound" | "outbound",
        created_at: r.created_at as string,
        status: r.status as string,
        media_url: r.media_url as string | null,
        media_type: r.media_type as string | null,
        user_id: r.user_id as string | null,
        sender_name: profile?.full_name ?? null,
      };
    });
  }

  const quickMessages = await listQuickMessages();

  const [{ data: professionals }, { data: services }, { data: whatsappAccounts }] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("whatsapp_accounts")
      .select("id, phone_number, display_name, provider")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  return (
    <ChatThread
      leadId={lead.id}
      tenantId={ctx.tenantId}
      leadName={displayLeadName(lead.name, lead.phone)}
      leadPhone={lead.phone ?? ""}
      conversationId={convo?.id ?? null}
      initialStatus={(convo?.status as ConversationStatus | null) ?? "nao_iniciada"}
      initialAutomationsEnabled={lead.automations_enabled ?? true}
      initialMessages={messages}
      quickMessages={quickMessages}
      professionals={professionals ?? []}
      services={(services ?? []) as { id: string; name: string; duration_minutes: number }[]}
      whatsappAccounts={(whatsappAccounts ?? []) as { id: string; phone_number: string; display_name: string | null; provider: string }[]}
    />
  );
}
