"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

// Aviso de manutencao pontual (migracao do banco Virginia -> Sao Paulo,
// 03/09/2026, ja em andamento). Some sozinho a partir do dia seguinte
// (compara a data de hoje em America/Sao_Paulo), entao nao precisa lembrar
// de remover depois - so o componente em si pode ser removido do layout
// quando nao for mais usado de novo.
const TARGET_DATE = "2026-09-03";
const DISMISS_KEY = `maintenance-notice-${TARGET_DATE}-dismissed`;

export function MaintenanceNoticeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const todayBRT = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (todayBRT !== TARGET_DATE) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // segue mostrando se o localStorage nao estiver disponivel
    }
    setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sem problema nao persistir - so volta a aparecer no proximo reload
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">
        <strong>Manutenção em andamento agora.</strong>{" "}
        O sistema pode ficar fora do ar por alguns minutos. Nenhum dado será perdido — mensagens do WhatsApp
        continuam chegando normalmente e aparecem assim que o sistema voltar.
      </span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
