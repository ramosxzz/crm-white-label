import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { UpdatesBell } from "./updates-bell";

export async function Topbar() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [{ data }, { data: updates }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .or(`user_id.is.null,user_id.eq.${ctx.userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("system_updates").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("profiles").select("last_seen_update_at").eq("id", ctx.userId).single(),
  ]);
  const lastSeen = profile?.last_seen_update_at ?? null;
  const hasUnread = Boolean(
    updates?.length && (!lastSeen || new Date(updates[0].created_at) > new Date(lastSeen)),
  );

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-end gap-1 border-b border-border bg-card/90 px-6 backdrop-blur-xl dark:border-border/40 dark:bg-background/75">
      <ThemeToggle />
      <UpdatesBell updates={updates ?? []} hasUnread={hasUnread} />
      <NotificationsBell initial={data ?? []} currentUserId={ctx.userId} />
    </header>
  );
}
