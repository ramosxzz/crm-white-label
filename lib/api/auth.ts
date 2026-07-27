import { createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { type ApiScope } from "@/lib/api/scopes";

export type { ApiScope };

export type ApiKeyContext = {
  tenantId: string;
  apiKeyId: string;
  scopes: ApiScope[];
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Formato: sk_live_<32 bytes hex>. O prefixo (sk_live_ + 8 chars) fica salvo
// em claro so pra exibir na listagem ("sk_live_a1b2c3d4...") - o valor
// completo nunca e persistido, so o hash.
export function generateApiKey(): { key: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `sk_live_${raw}`;
  const prefix = key.slice(0, 15);
  return { key, prefix };
}

export async function requireApiKeyContext(req: Request): Promise<ApiKeyContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const key = match?.[1]?.trim();
  if (!key) {
    throw new ApiError(401, "missing_api_key", "Envie o header Authorization: Bearer <sua_chave>");
  }

  const supabase = createServiceClient();
  const keyHash = hashApiKey(key);
  const { data: row } = await supabase
    .from("api_keys")
    .select("id, tenant_id, scopes, is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!row || !row.is_active) {
    throw new ApiError(401, "invalid_api_key", "Chave de API invalida ou revogada");
  }

  void supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);

  return {
    tenantId: row.tenant_id,
    apiKeyId: row.id,
    scopes: (row.scopes ?? []) as ApiScope[],
  };
}

export function requireScope(ctx: ApiKeyContext, scope: ApiScope) {
  if (!ctx.scopes.includes(scope)) {
    throw new ApiError(403, "missing_scope", `Esta chave nao tem o escopo "${scope}"`);
  }
}
