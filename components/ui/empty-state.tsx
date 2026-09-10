import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio compacto - o padrao antigo (ex: "Nenhum lead novo hoje
 * ainda.") ocupava 250-300px so pra dizer que nao tem nada. Isso vira o
 * conteudo, nao concorre com ele.
 */
export function EmptyState({
  message,
  action,
  compact = false,
  className,
}: {
  message: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 text-center text-sm text-muted-foreground",
        compact ? "px-3 py-4" : "px-4 py-6",
        className,
      )}
    >
      <p>{message}</p>
      {action}
    </div>
  );
}
