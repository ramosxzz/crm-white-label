"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import type { AccountHealthInfo } from "@/lib/whatsapp/health-checker";

export function WhatsAppHealthBanner({ alerts }: { alerts: AccountHealthInfo[] }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !alerts || alerts.length === 0) return null;

  const firstAlert = alerts[0];
  const label = firstAlert.displayName || firstAlert.phoneNumber;

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>
          <strong>Atenção:</strong> A conexão de WhatsApp <strong>{label}</strong> está {firstAlert.status === "offline" ? "desconectada" : "com instabilidade"}. Novas mensagens podem não chegar.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/settings/whatsapp"
          className="flex items-center gap-1 font-medium underline underline-offset-4 hover:opacity-80 text-xs sm:text-sm"
        >
          Reconectar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="rounded p-1 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300"
          title="Fechar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
