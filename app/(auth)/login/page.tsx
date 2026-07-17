"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildDemoWhatsappUrl } from "@/lib/demo-whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { mapSignupError } from "@/lib/auth/signup-errors";

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("auth_timeout")), ms);
    }),
  ]);
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const demoUrl = buildDemoWhatsappUrl();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">Entre com sua conta para acessar o painel</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading || redirecting}>
          {loading || redirecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {redirecting ? "Abrindo CRM..." : "Entrando..."}
            </>
          ) : (
            "Entrar"
          )}
        </Button>
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
          <p className="text-sm font-medium text-foreground">Quer conhecer o CRM?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solicite uma demo e liberamos o acesso com seguranca.
          </p>
          <Button asChild type="button" variant="outline" className="mt-3 w-full">
            <a href={demoUrl} target="_blank" rel="noreferrer">
              <MessageCircle className="h-4 w-4" />
              Solicitar demo
            </a>
          </Button>
        </div>
      </form>
    </div>
  );
}
