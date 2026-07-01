import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { buildConversationItems } from "@/lib/chat/build-conversation-items";
import { buildWhatsAppGroupItems } from "@/lib/chat/group-items";
import type { ConversationLeadRow } from "@/lib/chat/conversation-filter";
import { ConversationListLive } from "@/components/chat/conversation-list-live";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const service = createServiceClient();

  const [{ data: conversations }, { data: waAccount }, { data: groups }] = await Promise.all([
    supabase
      .from("conversations")
      .select(`
        id,
        lead_id,
        channel,
        last_message_at,
        unread_count,
        status,
        leads(name, phone, whatsapp_lid, custom_fields),
        messages(body, direction, created_at)
      `)
      .eq("tenant_id", ctx.tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(100)
      .limit(1, { referencedTable: "messages" }),
    supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .maybeSingle(),
    service
      .from("whatsapp_groups")
      .select(
        "id, provider_group_id, subject, description, participant_count, last_event_type, last_event_at, updated_at, last_message_body, last_message_direction, last_message_at",
      )
      .eq("tenant_id", ctx.tenantId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  const rows = (conversations ?? []) as unknown as ConversationLeadRow[];

  // Extrair as prévias das mensagens aninhadas diretamente da consulta única do Supabase (zero latência extra de rede!)
  const messagePreviews = (conversations ?? []).flatMap((c: any) => {
    const lastMsg = c.messages?.[0];
    if (!lastMsg) return [];
    return [{
      conversation_id: c.id,
      body: lastMsg.body,
      direction: lastMsg.direction,
      created_at: lastMsg.created_at,
    }];
  });

  const items = buildConversationItems(
    rows,
    messagePreviews,
    (waAccount as WhatsAppAccount | null) ?? null,
  );

  const groupRows = (groups ?? []) as Parameters<typeof buildWhatsAppGroupItems>[0];
  const groupIds = groupRows.map((group) => group.id);
  let assignments: {
    group_id: string;
    whatsapp_group_labels: { id: string; name: string; color: string } | null;
  }[] = [];

  if (groupIds.length > 0) {
    const { data } = await service
      .from("whatsapp_group_label_assignments")
      .select("group_id, whatsapp_group_labels(id, name, color)")
      .in("group_id", groupIds);
    assignments = (data ?? []) as typeof assignments;
  }

  const groupItems = buildWhatsAppGroupItems(groupRows, assignments);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden bg-background">
      <ConversationListLive tenantId={ctx.tenantId} initialItems={items} initialGroups={groupItems} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
