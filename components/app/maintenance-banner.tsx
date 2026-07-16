"use client";

import { useState } from "react";
import { Wrench, X } from "lucide-react";

// Aviso temporario de manutencao programada. Para remover depois, basta apagar
// o <MaintenanceBanner /> do layout (app/(app)/layout.tsx).
export function MaintenanceBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="flex items-center gap-2.5 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
      <Wrench className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1 text-xs font-medium leading-snug sm:text-sm">
        <span className="font-semibold">Manutenção programada:</span> nesta sexta-feira, a partir das 18h,
        até sábado às 15h. O sistema poderá ficar indisponível durante esse período enquanto aplicamos
        melhorias de infraestrutura.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Fechar aviso"
        className="shrink-0 rounded-md p-1 text-amber-900/70 transition-colors hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-100/70 dark:hover:text-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
