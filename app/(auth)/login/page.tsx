"use client";

import { useState } from "react";
import { ArrowRight, Eye, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { mapSignupError } from "@/lib/auth/signup-errors";
import { LoginCard } from "@/components/auth/login-card";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { checkLoginRateLimit } from "./actions";

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("auth_timeout")), ms);
    }),
  ]);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  function fillDemoCredentials() {
    setEmail("demo@solairew.com");
    setPassword("12345678");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const rateLimit = await checkLoginRateLimit(email, turnstileToken);
    if (!rateLimit.allowed) {
      setLoading(false);
      if (rateLimit.captchaFailed) {
        setError("Verificação de segurança falhou. Recarregue a página e tente de novo.");
      } else {
        const minutes = Math.ceil(rateLimit.retryAfter / 60);
        setError(`Muitas tentativas. Aguarde ${minutes} minuto${minutes === 1 ? "" : "s"} antes de tentar de novo.`);
      }
      return;
    }

    const supabase = createClient();
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
      );
      if (error) {
        setLoading(false);
        setError(mapSignupError(error.message));
        return;
      }
    } catch {
      setLoading(false);
      setError("Nao foi possivel conectar ao servidor de login agora. Tente novamente em alguns minutos.");
      return;
    }
    setRedirecting(true);
    // Navegacao completa de volta pela rota de login: o middleware ja conhece
    // o tenant e decide entre /dashboard e /os/agenda. O router.replace direto
    // para /dashboard fazia contas "So Agenda/OS" renderizarem uma rota
    // proibida e sofrerem um segundo redirect no layout, deixando a tela preta
    // ate um reload manual.
    window.location.replace("/login?authenticated=1");
  }

  return (
    <LoginCard>
      <div>
        <div className="mb-7 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Área segura</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Entrar no CRM W+</h1>
          <p className="text-sm leading-6 text-white/50">Use os dados da sua conta para acessar a operação.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/80">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            className="border-white/15 bg-white/[0.04] text-white placeholder:text-white/25"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/80">Senha</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-white/15 bg-white/[0.04] text-white"
          />
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <TurnstileWidget onVerify={setTurnstileToken} />
        <Button type="submit" size="lg" className="w-full bg-white text-[#05070c] hover:bg-cyan-50" disabled={loading || redirecting}>
          {loading || redirecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {redirecting ? "Abrindo CRM..." : "Entrando..."}
            </>
          ) : (
            <>
              Entrar no CRM
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
          <button type="button" onClick={fillDemoCredentials} className="mx-auto flex items-center gap-2 py-1 text-xs text-white/45 transition-colors hover:text-white">
            <Eye className="h-3.5 w-3.5" />
            Preencher acesso de demonstração
          </button>
        </form>
      </div>
    </LoginCard>
  );
}
