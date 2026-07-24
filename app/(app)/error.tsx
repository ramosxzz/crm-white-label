"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isStaleDeploymentError } from "@/lib/stale-deployment";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleDeploymentError(error);

  useEffect(() => {
    console.error(error);
    // Aba ficou aberta durante um deploy: o JS carregado ainda chama Server
    // Actions com o id da versao anterior, que o servidor novo nao reconhece.
    // "Tentar novamente" nao resolve (mesmo bundle velho) - precisa recarregar
    // pra pegar o JS atual.
    if (stale) {
      window.location.reload();
    }
  }, [error, stale]);

  if (stale) {
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
          Ocorreu um erro inesperado. Tente novamente; se persistir, recarregue a pagina.
        </p>
      </div>
      <Button onClick={reset}>
        <RotateCw className="mr-2 h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
