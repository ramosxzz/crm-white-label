import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "./notifications-bell";
import { UpdatesBell } from "./updates-bell";
import { MobileMenuButton } from "./mobile-menu-button";

export async function Topbar({ lastSeenUpdateAt }: { lastSeenUpdateAt: string | null }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [{ data }, { data: updates }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .or(`user_id.is.null,user_id.eq.${ctx.userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("system_updates").select("*").order("created_at", { ascending: false }).limit(20),
  ]);
  const lastSeen = lastSeenUpdateAt;
  const hasUnread = Boolean(
    updates?.length && (!lastSeen || new Date(updates[0].created_at) > new Date(lastSeen)),
  );

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between gap-1 border-b border-border bg-card/90 px-3 backdrop-blur-xl dark:border-border/40 dark:bg-background/75 md:justify-end md:px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}
    >
      <MobileMenuButton />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UpdatesBell updates={updates ?? []} hasUnread={hasUnread} />
        <NotificationsBell initial={data ?? []} currentUserId={ctx.userId} tenantId={ctx.tenantId} />
      </div>
    </header>
  );
}
