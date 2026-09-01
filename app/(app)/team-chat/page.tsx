import { PageHeader } from "@/components/app/page-header";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { TeamChatThread } from "./team-chat-thread";

export const dynamic = "force-dynamic";

const MESSAGE_SELECT = "id, tenant_id, sender_id, body, media_url, media_type, mentions, created_at, edited_at, deleted_at";

export default async function TeamChatPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const [{ data: messages }, members] = await Promise.all([
    supabase
      .from("team_messages")
      .select(MESSAGE_SELECT)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true })
      .limit(200),
    listTenantUserOptions(ctx.tenantId),
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader title="Chat da equipe" description="Conversa interna do time — mencione com @ e mande audio." />
      <TeamChatThread
        tenantId={ctx.tenantId}
        currentUserId={ctx.userId}
        members={members}
        initialMessages={messages ?? []}
      />
    </div>
  );
}
