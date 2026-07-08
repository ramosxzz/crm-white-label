"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
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
