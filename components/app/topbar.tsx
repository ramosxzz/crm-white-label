import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "./notifications-bell";

export async function Topbar() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .or(`user_id.is.null,user_id.eq.${ctx.userId}`)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-end gap-1 border-b border-border bg-card/90 px-6 backdrop-blur-xl dark:border-border/40 dark:bg-background/75">
      <ThemeToggle />
      <NotificationsBell initial={data ?? []} currentUserId={ctx.userId} />
    </header>
  );
}
