"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStaleDeploymentError } from "@/lib/stale-deployment";

/**
 * Marca do ultimo reload automatico. Se o recurso realmente sumiu (e nao e so
 * bundle velho), recarregar de novo daria no mesmo erro e a tela entraria em
 * loop infinito - pior que mostrar o erro. Uma tentativa a cada 10s: um loop
 * volta em milissegundos e fica barrado, um deploy novo meia hora depois ainda
 * recarrega normalmente.
 */
const RELOAD_MARK_KEY = "solaire:stale-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

function shouldAutoReload() {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_MARK_KEY) ?? 0);
    const now = Date.now();
    window.sessionStorage.setItem(RELOAD_MARK_KEY, String(now));
    return now - last > RELOAD_COOLDOWN_MS;
  } catch {
    // sessionStorage bloqueado (aba anonima com restricao, por exemplo): sem
    // como detectar loop, melhor nao recarregar sozinho.
    return false;
  }
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleDeploymentError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error(error);
    if (!stale) return;
    if (shouldAutoReload()) {
      setReloading(true);
      window.location.reload();
    }
  }, [error, stale]);

  if (reloading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <RotateCw className="h-10 w-10 animate-spin text-muted-foreground" />
        <div>
          <p className="text-base font-semibold">O sistema foi atualizado</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Recarregando a pagina...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div>
        <p className="text-base font-semibold">Algo deu errado nessa tela</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {stale
            ? "A pagina foi recarregada e o erro continuou. Se persistir, avise o suporte."
            : "Ocorreu um erro inesperado. Tente novamente; se persistir, recarregue a pagina."}
        </p>
        {error.digest && (
          // O detalhe de erro de Server Component fica no log do servidor; o
          // digest e o que liga o relato do usuario aquela linha do log.
          <p className="mt-2 font-mono text-xs text-muted-foreground/70">
            codigo {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset}>
        <RotateCw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
