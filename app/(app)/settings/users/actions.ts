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
  receivesAutomaticLeads: boolean;
  osOnlyAccess: boolean;
};

const editableRoles: MemberRole[] = ["admin", "gerente", "atendente", "vendedor", "tecnico", "prospeccao"];
const roundRobinRoles: MemberRole[] = ["atendente", "vendedor"];

function normalizeRole(role: string): MemberRole {
  if (editableRoles.includes(role as MemberRole)) return role as MemberRole;
  throw new Error("Cargo invalido");
}

function normalizePassword(password: string) {
  const value = password.trim();
  if (value.length < 8) throw new Error("A senha temporaria precisa ter pelo menos 8 caracteres");
  return value;
}

// Qualquer excecao que nao seja um Error "limpo" (ex: objeto cru de erro do
// Postgrest/Auth, undefined, etc) faz o Next.js trocar a mensagem por um
// texto generico e redigido em producao ("An error occurred in the Server
// Components render..."). Normaliza tudo pra um Error de verdade com a
// mensagem real, pra sempre aparecer algo legivel pro usuario.
function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

export async function listTeamUsers(): Promise<TeamUser[]> {
  const ctx = await requireContext();
  const supabase = createServiceClient();
  const db = supabase as any;

  const { data: members, error } = await db
    .from("tenant_members")
    .select("user_id, role, created_at, os_only_access")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const memberRows = (members ?? []) as Array<{
    user_id: string;
    role: MemberRole;
    created_at: string;
    os_only_access: boolean | null;
  }>;
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

  const { data: availability } = await db
    .from("attendant_status")
    .select("user_id, is_available")
    .eq("tenant_id", ctx.tenantId)
    .in("user_id", ids);
  const availabilityMap = new Map(
    ((availability ?? []) as Array<{ user_id: string; is_available: boolean }>).map((row) => [
      row.user_id,
      row.is_available,
    ]),
  );

  return memberRows.map((member) => ({
    userId: member.user_id,
    fullName: profileMap.get(member.user_id) || emailMap.get(member.user_id)?.split("@")[0] || "Usuario",
    email: emailMap.get(member.user_id) || "",
    role: member.role as MemberRole,
    createdAt: member.created_at,
    isCurrentUser: member.user_id === ctx.userId,
    receivesAutomaticLeads: availabilityMap.get(member.user_id) ?? false,
    osOnlyAccess: Boolean(member.os_only_access),
  }));
}

/** Login restrito a Agenda/OS - ver o modulo de servico em campo e mais
 * nada do CRM. So faz sentido com o modulo ligado, e nunca pro proprio
 * dono da conta. */
export async function setTeamUserOsOnlyAccess(input: { userId: string; osOnlyAccess: boolean }) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageUsers);
  if (!ctx.tenant.field_service_enabled) {
    throw new Error("Modulo de servico em campo desativado para esta empresa");
  }
  const supabase = createServiceClient();
  const db = supabase as any;

  const { data: member } = await db
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if ((member as { role?: MemberRole } | null)?.role === "owner") {
    throw new Error("Nao e possivel restringir o proprietario");
  }

  const { error } = await db
    .from("tenant_members")
    .update({ os_only_access: input.osOnlyAccess })
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", input.userId);
  if (error) throw new Error(toErrorMessage(error, "Nao foi possivel atualizar o acesso"));

  revalidatePath("/settings/users");
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

  try {
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
      throw new Error(toErrorMessage(error, "Nao foi possivel criar o usuario"));
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
    if (profileError) throw new Error(toErrorMessage(profileError, "Nao foi possivel salvar o perfil do usuario"));

    const { error: memberError } = await db
      .from("tenant_members")
      .upsert({
        tenant_id: ctx.tenantId,
        user_id: userId,
        role,
      });
    if (memberError) throw new Error(toErrorMessage(memberError, "Nao foi possivel vincular o usuario a esta empresa"));

    if (roundRobinRoles.includes(role)) {
      const { error: availabilityError } = await db.from("attendant_status").upsert({
        tenant_id: ctx.tenantId,
        user_id: userId,
        is_available: false,
      });
      if (availabilityError) {
        throw new Error(toErrorMessage(availabilityError, "Nao foi possivel configurar a distribuicao de leads"));
      }
    }

    if (temporaryTenantId && temporaryTenantId !== ctx.tenantId) {
      await db.from("tenants").delete().eq("id", temporaryTenantId);
    }
  } catch (err) {
    console.error("[settings/users] createTeamUser falhou:", err);
    throw new Error(toErrorMessage(err, "Nao foi possivel criar o usuario. Tente novamente."));
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
  try {
    const { error } = await db
      .from("tenant_members")
      .update({ role })
      .eq("tenant_id", ctx.tenantId)
      .eq("user_id", input.userId);

    if (error) throw new Error(toErrorMessage(error, "Nao foi possivel alterar o cargo"));

    if (!roundRobinRoles.includes(role)) {
      await db
        .from("attendant_status")
        .update({ is_available: false })
        .eq("tenant_id", ctx.tenantId)
        .eq("user_id", input.userId);
    }
  } catch (err) {
    console.error("[settings/users] updateTeamUserRole falhou:", err);
    throw new Error(toErrorMessage(err, "Nao foi possivel alterar o cargo. Tente novamente."));
  }
  revalidatePath("/settings/users");
}

export async function setTeamUserLeadAvailability(input: {
  userId: string;
  isAvailable: boolean;
}) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageUsers);
  const supabase = createServiceClient();
  const db = supabase as any;

  const { data: member, error: memberError } = await db
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member || !roundRobinRoles.includes(member.role as MemberRole)) {
    throw new Error("Somente atendentes e vendedores podem receber leads automaticamente");
  }

  const { error } = await db.from("attendant_status").upsert({
    tenant_id: ctx.tenantId,
    user_id: input.userId,
    is_available: input.isAvailable,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/settings/users");
}

export async function removeTeamUser(userId: string) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageUsers);
  if (userId === ctx.userId) throw new Error("Voce nao pode remover seu proprio acesso");

  const supabase = createServiceClient();
  const db = supabase as any;
  try {
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

    if (error) throw new Error(toErrorMessage(error, "Nao foi possivel remover o usuario"));
  } catch (err) {
    console.error("[settings/users] removeTeamUser falhou:", err);
    throw new Error(toErrorMessage(err, "Nao foi possivel remover o usuario. Tente novamente."));
  }
  revalidatePath("/settings/users");
  revalidatePath("/", "layout");
}
