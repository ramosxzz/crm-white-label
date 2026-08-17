import { ApiError } from "@/lib/api/auth";

export interface RateLimitOptions {
  /** Quantidade máxima de requisições permitidas na janela */
  limit: number;
  /** Duração da janela em milissegundos (ex: 60_000 para 1 minuto) */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

interface WindowRecord {
  timestamps: number[];
}

// Armazenamento em memória com limpeza de TTL
const memoryStore = new Map<string, WindowRecord>();
let lastCleanup = Date.now();

function cleanupExpiredRecords(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < 30_000) return;
  lastCleanup = now;

  for (const [key, record] of memoryStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
    if (record.timestamps.length === 0) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Verifica se a requisição está dentro dos limites de taxa (Sliding Window Counter).
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60_000 }
): RateLimitResult {
  const now = Date.now();
  const { limit, windowMs } = options;

  cleanupExpiredRecords(windowMs);

  let record = memoryStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(identifier, record);
  }

  // Remove timestamps fora da janela deslizante
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  const reset = Math.ceil((now + windowMs) / 1000);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0] || now;
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

    return {
      success: false,
      limit,
      remaining: 0,
      reset,
      retryAfter,
    };
  }

  // Registra a nova requisição
  record.timestamps.push(now);

  const remaining = Math.max(0, limit - record.timestamps.length);

  return {
    success: true,
    limit,
    remaining,
    reset,
    retryAfter: 0,
  };
}

/**
 * Aplica rate limit e lança ApiError(429) se ultrapassado (para rotas da API v1).
 */
export function enforceRateLimit(key: string, limit: number = 120, windowMs: number = 60_000): void {
  const result = checkRateLimit(`apikey:${key}`, { limit, windowMs });
  if (!result.success) {
    throw new ApiError(
      429,
      "rate_limit_exceeded",
      `Taxa de requisicoes excedida. Limite de ${limit} req/min. Tente novamente em ${result.retryAfter}s.`
    );
  }
}

/**
 * Obtém o IP do cliente a partir dos headers comuns (Cloudflare, proxies, load balancers).
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "127.0.0.1";
}

/**
 * Adiciona headers padrão de rate-limiting à resposta.
 */
export function applyRateLimitHeaders(
  headers: Headers | Record<string, string>,
  result: RateLimitResult
): Headers {
  const h = headers instanceof Headers ? headers : new Headers(headers);
  h.set("X-RateLimit-Limit", String(result.limit));
  h.set("X-RateLimit-Remaining", String(result.remaining));
  h.set("X-RateLimit-Reset", String(result.reset));
  if (!result.success && result.retryAfter > 0) {
    h.set("Retry-After", String(result.retryAfter));
  }
  return h;
}

/**
 * Retorna uma resposta HTTP 429 Too Many Requests formatada.
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  customHeaders?: Record<string, string>
): Response {
  const headers = new Headers(customHeaders);
  headers.set("Content-Type", "application/json");
  applyRateLimitHeaders(headers, result);

  return new Response(
    JSON.stringify({
      error: "Too Many Requests",
      message: `Taxa de requisicoes excedida. Tente novamente em ${result.retryAfter} segundos.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers,
    }
  );
}

/**
 * Reseta o store em memória (útil para testes).
 */
export function _resetRateLimitStore() {
  memoryStore.clear();
}
