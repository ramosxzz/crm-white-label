"use server";

import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function markSystemUpdatesSeen() {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ last_seen_update_at: new Date().toISOString() })
    .eq("id", ctx.userId);
}
