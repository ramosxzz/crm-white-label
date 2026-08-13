import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Tenant, MemberRole } from "./supabase/database.types";

export interface CurrentContext {
  userId: string;
  userEmail: string;
  tenantId: string;
  tenant: Tenant;
  role: MemberRole;
  /** Login restrito a Agenda/OS - ve so o modulo de servico em campo, nada
   * mais do CRM. Independente do role (ver migration os_only_access). */
  osOnlyAccess: boolean;
}

const TENANT_COOKIE = "avante_tenant_id";

export const getCurrentContext = cache(async (): Promise<CurrentContext | null> => {
  const supabase = await createClient();
  // getClaims() verifica o JWT localmente (o projeto usa chave assimetrica -
  // ES256), sem round-trip pro servidor de Auth a cada navegacao/acao, ao
  // contrario de getUser(). getCurrentContext roda em toda pagina do app.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  const userId = claims.sub;

  const cookieStore = await cookies();
  const cookieTenant = cookieStore.get(TENANT_COOKIE)?.value;

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, os_only_access, tenants(*)")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return null;

  const chosen =
    memberships.find((m) => m.tenant_id === cookieTenant) ?? memberships[0];

  const tenant = (chosen as unknown as { tenants: Tenant }).tenants;
  return {
    userId,
    userEmail: (claims.email as string | undefined) ?? "",
    tenantId: chosen.tenant_id,
    tenant,
    role: chosen.role as MemberRole,
    osOnlyAccess: Boolean((chosen as unknown as { os_only_access: boolean | null }).os_only_access),
  };
});

export async function requireContext(): Promise<CurrentContext> {
  const ctx = await getCurrentContext();
  if (!ctx) throw new Error("Nao autenticado ou sem tenant");
  return ctx;
}

export async function setActiveTenant(tenantId: string) {
  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
