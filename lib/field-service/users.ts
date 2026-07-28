import { createServiceClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/supabase/database.types";

export type FieldServiceUser = {
  id: string;
  name: string;
  role: MemberRole;
};

/**
 * Usuarios do tenant filtrados por papel. Usado pra montar os selects de
 * tecnico (quem executa a OS) e de consultora (quem vendeu).
 *
 * Vai pelo service client porque precisa cruzar tenant_members com profiles,
 * mesmo motivo de listTenantUserOptions em lib/tenant/users.ts.
 */
export async function listTenantUsersByRole(
  tenantId: string,
  roles: MemberRole[],
): Promise<FieldServiceUser[]> {
  const supabase = createServiceClient() as any;

  const { data: members, error } = await supabase
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .in("role", roles)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (members ?? []) as Array<{ user_id: string; role: MemberRole }>;
  const userIds = [...new Set(rows.map((m) => m.user_id).filter(Boolean))];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [
      p.id,
      p.full_name?.trim() || `Usuario ${p.id.slice(0, 6)}`,
    ]),
  );

  const roleById = new Map(rows.map((m) => [m.user_id, m.role]));

  return userIds.map((id) => ({
    id,
    name: nameById.get(id) ?? `Usuario ${id.slice(0, 6)}`,
    role: roleById.get(id) as MemberRole,
  }));
}

export function listTechnicians(tenantId: string) {
  return listTenantUsersByRole(tenantId, ["tecnico"]);
}

/** Quem pode aparecer como consultora da venda. */
export function listConsultants(tenantId: string) {
  return listTenantUsersByRole(tenantId, ["owner", "admin", "gerente", "atendente", "vendedor"]);
}
