import type { SupabaseClient } from "@supabase/supabase-js";

export async function getTeamChatUnreadCount(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<number> {
  const { data: readRow } = await supabase
    .from("team_message_reads")
    .select("last_read_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  let query = supabase
    .from("team_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .neq("sender_id", userId)
    .is("deleted_at", null);

  if (readRow?.last_read_at) query = query.gt("created_at", readRow.last_read_at);

  const { count } = await query;
  return count ?? 0;
}
