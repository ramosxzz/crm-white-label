import { createServiceClient } from "@/lib/supabase/server";

export type TenantUserOption = {
  id: string;
  name: string;
};

export async function listTenantUserOptions(tenantId: string): Promise<TenantUserOption[]> {
  const supabase = createServiceClient() as any;
  const { data: members, error } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const userIds = [...new Set(((members ?? []) as Array<{ user_id: string }>).map((member) => member.user_id).filter(Boolean))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [
      profile.id,
      profile.full_name?.trim() || `Usuario ${profile.id.slice(0, 6)}`,
    ]),
  );

  return userIds.map((id) => ({
    id,
    name: profileMap.get(id) ?? `Usuario ${id.slice(0, 6)}`,
  }));
}
