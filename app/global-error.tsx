"use client";

import { useEffect } from "react";
import { isStaleDeploymentError } from "@/lib/stale-deployment";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleDeploymentError(error);

  useEffect(() => {
    console.error(error);
    // Ver comentario em app/(app)/error.tsx: erro de Server Action de deploy
    // antigo, so resolve com reload de verdade.
    if (stale) {
      window.location.reload();
    }
  }, [error, stale]);

  if (stale) {
    return (
      <html lang="pt-BR">
        <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center font-sans text-foreground">
          <div>
            <p className="text-base font-semibold">O sistema foi atualizado</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Recarregando a pagina...</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center font-sans text-foreground">
        <div>
          <p className="text-base font-semibold">O CRM encontrou um erro</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Recarregue a pagina. Se o problema continuar, avise o suporte.
          </p>
        </div>
        <button
          onClick={reset}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
