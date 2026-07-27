import { ApiError } from "@/lib/api/auth";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

// Em memoria, por processo - suficiente pra uma instancia unica (VPS atual).
// Se o app for pra multiplas instancias, precisa virar Redis/Postgres.
const hits = new Map<string, number[]>();

export function enforceRateLimit(apiKeyId: string) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(apiKeyId) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new ApiError(429, "rate_limited", "Limite de requisicoes excedido (120/min). Tente novamente em instantes.");
  }
  timestamps.push(now);
  hits.set(apiKeyId, timestamps);
}
