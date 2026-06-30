"use server";

import { revalidatePath } from "next/cache";

import { assertRole, canManageUsers } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import type { MemberRole } from "@/lib/supabase/database.types";

export type TeamUser = {
  userId: string;
  fullName: string;
  email: string;
  role: MemberRole;
  createdAt: string;
  isCurrentUser: boolean;
};

const editableRoles: MemberRole[] = ["admin", "gerente", "atendente", "vendedor"];

function normalizeRole(role: string): MemberRole {
  if (editableRoles.includes(role as MemberRole)) return role as MemberRole;
  throw new Error("Cargo invalido");
}

function normalizePassword(password: string) {
  const value = password.trim();
  if (value.length < 8) throw new Error("A senha temporaria precisa ter pelo menos 8 caracteres");
  return value;
}

export async function listTeamUsers(): Promise<TeamUser[]> {
  const ctx = await requireContext();
  const supabase = createServiceClient();
  const db = supabase as any;

  const { data: members, error } = await db
    .from("tenant_members")
    .select("user_id, role, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const memberRows = (members ?? []) as Array<{ user_id: string; role: MemberRole; created_at: string }>;
  const ids = memberRows.map((member) => member.user_id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  const profileRows = (profiles ?? []) as Array<{ id: string; full_name: string | null }>;
  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile.full_name ?? ""]));

  const { data: authUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap = new Map(
    (authUsers?.users ?? [])
      .filter((user) => ids.includes(user.id))
      .map((user) => [user.id, user.email ?? ""]),
  );

  return memberRows.map((member) => ({
    userId: member.user_id,
    fullName: profileMap.get(member.user_id) || emailMap.get(member.user_id)?.split("@")[0] || "Usuario",
    email: emailMap.get(member.user_id) || "",
    role: member.role as MemberRole,
    createdAt: member.created_at,
    isCurrentUser: member.user_id === ctx.userId,
  }));
}

export async function createTeamUser(input: {
  fullName: string;
  email: string;
  password: string;
  role: string;
}) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageUsers);

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = normalizePassword(input.password);
  const role = normalizeRole(input.role);

  if (!fullName) throw new Error("Informe o nome do usuario");
  if (!email.includes("@")) throw new Error("Informe um e-mail valido");

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      company_name: ctx.tenant.name,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Nao foi possivel criar o usuario");
  }

  const userId = data.user.id;

  const db = supabase as any;

  const { data: createdProfile } = await db
    .from("profiles")
    .select("default_tenant_id")
    .eq("id", userId)
    .maybeSingle();

  const temporaryTenantId = (createdProfile as { default_tenant_id?: string | null } | null)?.default_tenant_id;

  const { error: profileError } = await db
    .from("profiles")
    .upsert({
      id: userId,
      full_name: fullName,
      default_tenant_id: ctx.tenantId,
    });
  if (profileError) throw new Error(profileError.message);

  const { error: memberError } = await db
    .from("tenant_members")
    .upsert({
      tenant_id: ctx.tenantId,
      user_id: userId,
      role,
    });
  if (memberError) throw new Error(memberError.message);

  if (temporaryTenantId && temporaryTenantId !== ctx.tenantId) {
    await db.from("tenants").delete().eq("id", temporaryTenantId);
  }

  revalidatePath("/settings/users");
  revalidatePath("/", "layout");
}

export async function updateTeamUserRole(input: { userId: string; role: string }) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageUsers);
  if (input.userId === ctx.userId) throw new Error("Voce nao pode alterar seu proprio cargo");

  const role = normalizeRole(input.role);
  const supabase = createServiceClient();
  const db = supabase as any;
  const { error } = await db
    .from("tenant_members")
    .update({ role })
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", input.userId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/users");
}

export async function removeTeamUser(userId: string) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageUsers);
  if (userId === ctx.userId) throw new Error("Voce nao pode remover seu proprio acesso");

  const supabase = createServiceClient();
  const db = supabase as any;
  const { data: member } = await db
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if ((member as { role?: MemberRole } | null)?.role === "owner") throw new Error("Nao e possivel remover o proprietario");

  const { error } = await db
    .from("tenant_members")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/users");
  revalidatePath("/", "layout");
}
