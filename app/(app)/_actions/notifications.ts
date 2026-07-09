"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function markNotificationRead(id: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .or(`user_id.is.null,user_id.eq.${ctx.userId}`);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("tenant_id", ctx.tenantId)
    .or(`user_id.is.null,user_id.eq.${ctx.userId}`)
    .eq("is_read", false);
  revalidatePath("/", "layout");
}
