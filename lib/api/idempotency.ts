import type { SupabaseClient } from "@supabase/supabase-js";

export interface IdempotencyCheckParams {
  key: string;
  tenantId: string | null;
  endpoint: string;
  payload: unknown;
}

export interface IdempotentRecord {
  responseStatus: number;
  responseBody: unknown;
  isCached: boolean;
}

/**
 * Gera um hash determinístico simples e rápido para comparação de payloads.
 */
export function hashPayload(payload: unknown): string {
  try {
    const serialized = JSON.stringify(payload ?? {});
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Converte para inteiro 32-bit
    }
    return String(Math.abs(hash));
  } catch {
    return "0";
  }
}

/**
 * Busca uma resposta idempotente salva previamente.
 */
export async function getIdempotentResponse(
  supabase: SupabaseClient,
  params: IdempotencyCheckParams
): Promise<{ cached: IdempotentRecord | null; conflict: boolean }> {
  const { key, tenantId, endpoint, payload } = params;
  if (!key || !key.trim()) {
    return { cached: null, conflict: false };
  }

  const currentHash = hashPayload(payload);

  let query = supabase
    .from("idempotency_records")
    .select("response_status, response_body, request_hash, expires_at")
    .eq("key", key.trim())
    .eq("endpoint", endpoint);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: record, error } = await query.maybeSingle();

  if (error || !record) {
    return { cached: null, conflict: false };
  }

  // Verifica se expirou
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { cached: null, conflict: false };
  }

  // Se o hash do payload for diferente para a mesma chave, há conflito de parâmetros
  if (record.request_hash !== currentHash) {
    return { cached: null, conflict: true };
  }

  return {
    cached: {
      responseStatus: record.response_status,
      responseBody: record.response_body,
      isCached: true,
    },
    conflict: false,
  };
}

/**
 * Salva a resposta gerada para reutilização em futuras requisições com a mesma Idempotency-Key.
 */
export async function saveIdempotentResponse(
  supabase: SupabaseClient,
  params: IdempotencyCheckParams & { status: number; body: unknown }
): Promise<void> {
  const { key, tenantId, endpoint, payload, status, body } = params;
  if (!key || !key.trim()) return;

  const currentHash = hashPayload(payload);

  try {
    await supabase.from("idempotency_records").upsert(
      {
        key: key.trim(),
        tenant_id: tenantId,
        endpoint,
        request_hash: currentHash,
        response_status: status,
        response_body: body,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "key,tenant_id" }
    );
  } catch (err) {
    // Falha silenciosa de idempotência para não travar o fluxo principal
    console.error("[idempotency] Erro ao salvar registro:", err);
  }
}
