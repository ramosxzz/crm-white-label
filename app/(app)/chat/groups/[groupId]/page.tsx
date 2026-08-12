import { notFound } from "next/navigation";
import { listQuickMessages } from "@/app/(app)/settings/quick-messages-actions";
import { GroupChatThread } from "./group-chat-thread";
import { fetchGroupMessages, markGroupRead } from "../../actions";
import {
  canAccessConversationAccount,
  getChatAccountVisibility,
} from "@/lib/chat/list-conversation-items";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export default async function GroupChatPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const ctx = await requireContext();
  const service = createServiceClient();
  const { data: group } = await service
    .from("whatsapp_groups")
    .select("id, subject, participant_count, whatsapp_account_id")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!group) notFound();

  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (!canAccessConversationAccount(group.whatsapp_account_id, visibility)) notFound();

  const [messages, quickMessages, assignmentsResult] = await Promise.all([
    fetchGroupMessages(groupId),
    listQuickMessages(),
    service
      .from("whatsapp_group_label_assignments")
      .select("whatsapp_group_labels(id, name, color)")
      .eq("tenant_id", ctx.tenantId)
      .eq("group_id", groupId),
  ]);
  await markGroupRead(groupId);
  const labels = (assignmentsResult.data ?? []).flatMap((assignment) => {
    const label = assignment.whatsapp_group_labels;
    return label ? (Array.isArray(label) ? label : [label]) : [];
  });

  return (
    <GroupChatThread
      groupId={group.id}
      tenantId={ctx.tenantId}
      subject={group.subject}
      participantCount={group.participant_count}
      labels={labels}
      initialMessages={messages}
      quickMessages={quickMessages}
    />
  );
}
