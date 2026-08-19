/** Verifica o token do Cloudflare Turnstile (captcha invisivel) no login.
 * Se TURNSTILE_SECRET_KEY nao estiver configurada, deixa passar - assim o
 * deploy nao quebra login pra ninguem antes da chave ser criada (gratis,
 * em dash.cloudflare.com > Turnstile > Add site). */
export async function verifyTurnstileToken(token: string | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    // Falha de rede pro Cloudflare nao pode travar todo mundo fora do CRM.
    return true;
  }
}
