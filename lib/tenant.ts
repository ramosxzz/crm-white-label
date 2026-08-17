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
const CACHE_TTL_MS = 20_000; // 20 segundos de cache em memória por sessão

interface CachedContext {
  context: CurrentContext;
  expiresAt: number;
}

const contextMemoryCache = new Map<string, CachedContext>();

export const getCurrentContext = cache(async (): Promise<CurrentContext | null> => {
  const supabase = await createClient();
  // getClaims() verifica o JWT localmente (chave assimetrica ES256) sem round-trip
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  const userId = claims.sub;

  const cookieStore = await cookies();
  const cookieTenant = cookieStore.get(TENANT_COOKIE)?.value || "default";
  const cacheKey = `${userId}:${cookieTenant}`;

  // Verifica cache em memória para navegação instantânea
  const cached = contextMemoryCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.context;
  }

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, os_only_access, tenants(*)")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return null;

  const chosen =
    memberships.find((m) => m.tenant_id === cookieTenant) ?? memberships[0];

  const tenant = (chosen as unknown as { tenants: Tenant }).tenants;
  const context: CurrentContext = {
    userId,
    userEmail: (claims.email as string | undefined) ?? "",
    tenantId: chosen.tenant_id,
    tenant,
    role: chosen.role as MemberRole,
    osOnlyAccess: Boolean((chosen as unknown as { os_only_access: boolean | null }).os_only_access),
  };

  contextMemoryCache.set(cacheKey, {
    context,
    expiresAt: now + CACHE_TTL_MS,
  });

  return context;
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

/** Invalida o cache do contexto em memória para o usuário atual */
export function invalidateContextCache(userId?: string) {
  if (!userId) {
    contextMemoryCache.clear();
    return;
  }
  for (const key of contextMemoryCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      contextMemoryCache.delete(key);
    }
  }
}
