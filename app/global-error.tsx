"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
