"use server";

import { headers } from "next/headers";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { verifyTurnstileToken } from "@/lib/auth/turnstile";

/** Limita tentativas de login por IP+email e confere o captcha (se
 * configurado) antes do client chamar o Supabase Auth direto - sem isso nao
 * tinha nenhuma barreira nossa contra brute-force (so o rate limit nativo do
 * GoTrue, que a gente nao controla). */
export async function checkLoginRateLimit(
  email: string,
  turnstileToken: string | null,
): Promise<{ allowed: boolean; retryAfter: number; captchaFailed?: boolean }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  const captchaOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!captchaOk) {
    return { allowed: false, retryAfter: 0, captchaFailed: true };
  }

  const key = `login:${ip}:${email.trim().toLowerCase()}`;
  const result = checkRateLimit(key, { limit: 6, windowMs: 5 * 60_000 });
  return { allowed: result.success, retryAfter: result.retryAfter };
}
