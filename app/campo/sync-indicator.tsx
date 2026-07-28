"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, Check } from "lucide-react";
import { pendingCount } from "@/lib/field-service/offline";
import { notify } from "@/lib/ui/feedback";
import { syncNow } from "./sync";

/**
 * Estado da conexao e da fila. Fica no cabecalho porque o tecnico precisa
 * saber, sem procurar, se o que ele acabou de registrar ja subiu ou ainda
 * esta no celular.
 */
export function SyncIndicator() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  // O guard de concorrencia mora num ref, nao no state: o listener de
  // "online" e registrado uma unica vez e congelaria o valor do state,
  // deixando dois flushes rodarem juntos e subirem a mesma assinatura duas
  // vezes.
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPending(await pendingCount());
  }, []);

  const flush = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const outcome = await syncNow();
      if (outcome.sent.length > 0) {
        notify({
          title: `${outcome.sent.length} registro(s) sincronizado(s)`,
          tone: "success",
        });
        router.refresh();
      }
      if (outcome.abandoned.length > 0) {
        notify({
          title: "Alguns registros nao subiram",
          description: "Avise o escritorio: eles precisam ser lancados na mao.",
          tone: "error",
        });
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshCount();

    function handleOnline() {
      setOnline(true);
      void flush();
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Ao abrir a tela ja tenta subir o que ficou de um turno anterior.
    if (navigator.onLine) void flush();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // flush/refreshCount sao estaveis via useCallback; rodar so na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!online) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
        <CloudOff className="h-3.5 w-3.5" />
        Offline{pending > 0 ? ` · ${pending}` : ""}
      </span>
    );
  }

  if (pending > 0 || syncing) {
    return (
      <button
        type="button"
        onClick={() => void flush()}
        disabled={syncing}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info"
      >
        <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
        {syncing ? "Enviando..." : `Enviar ${pending}`}
      </button>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
      <Check className="h-3.5 w-3.5" />
      Tudo enviado
    </span>
  );
}
