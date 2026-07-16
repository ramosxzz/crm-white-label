import type { SupabaseClient } from "@supabase/supabase-js";

/** Cria uma notificacao para um usuario. Nunca lanca. */
export async function notifyUser(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    userId: string;
    kind: string;
    title: string;
    description?: string | null;
    link?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("notifications").insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      description: input.description ?? null,
      link: input.link ?? null,
    });
  } catch (err) {
    console.error("[notify] erro ao criar notificacao:", err);
  }
}

/** Retorna o user_id do dono (owner) do tenant, ou null. */
export async function getTenantOwnerId(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}
