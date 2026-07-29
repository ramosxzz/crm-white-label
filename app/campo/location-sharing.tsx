"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff } from "lucide-react";
import { TRACKING_WINDOW_LABEL, isWithinTrackingWindow } from "@/lib/field-service/tracking-window";
import { clearTechnicianLocation, updateTechnicianLocation } from "./actions";

/** De quanto em quanto tempo a posicao sobe. */
const SEND_INTERVAL_MS = 60_000;

type Estado =
  | "checando"
  | "compartilhando"
  | "fora_do_horario"
  | "sem_os_hoje"
  | "sem_permissao"
  | "sem_sinal";

const TEXTO: Record<Exclude<Estado, "checando">, { titulo: string; detalhe: string }> = {
  compartilhando: {
    titulo: "Sua localização está sendo compartilhada",
    detalhe: `Só durante o expediente, ${TRACKING_WINDOW_LABEL}, e apenas nos dias em que você tem ordem de serviço. O escritório vê onde você está agora, não por onde passou.`,
  },
  fora_do_horario: {
    titulo: "Localização desligada",
    detalhe: `Fora do expediente (${TRACKING_WINDOW_LABEL}) sua posição não é compartilhada.`,
  },
  sem_os_hoje: {
    titulo: "Localização desligada",
    detalhe: "Você não tem ordem de serviço para hoje, então sua posição não é compartilhada.",
  },
  sem_permissao: {
    titulo: "Localização bloqueada no aparelho",
    detalhe:
      "O escritório usa sua posição para organizar as visitas do dia. Libere a localização nas permissões do navegador se quiser compartilhar.",
  },
  sem_sinal: {
    titulo: "Sem sinal de GPS",
    detalhe: "Não foi possível obter sua posição agora. O aplicativo tenta de novo sozinho.",
  },
};

/**
 * Compartilhamento de posicao do tecnico.
 *
 * O aviso e permanente e em primeiro plano de proposito: rastrear funcionario
 * so e legitimo se ele souber que esta acontecendo, por que, e em que janela.
 * O texto diz as tres coisas, e diz tambem o que NAO e guardado (o trajeto).
 *
 * O corte por horario acontece aqui e de novo no servidor - aqui pra nao gastar
 * bateria a toa, la porque e o servidor que decide.
 */
export function LocationSharing() {
  const [estado, setEstado] = useState<Estado>("checando");
  const jaLimpou = useRef(false);

  const enviar = useCallback(() => {
    if (!isWithinTrackingWindow()) {
      setEstado("fora_do_horario");
      // Sai do expediente: apaga a ultima posicao, uma vez so.
      if (!jaLimpou.current) {
        jaLimpou.current = true;
        void clearTechnicianLocation().catch(() => {});
      }
      return;
    }
    jaLimpou.current = false;

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setEstado("sem_permissao");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const resultado = await updateTechnicianLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_meters: pos.coords.accuracy ?? null,
          });
          setEstado(resultado.shared ? "compartilhando" : resultado.reason);
        } catch {
          setEstado("sem_sinal");
        }
      },
      (erro) => {
        setEstado(erro.code === erro.PERMISSION_DENIED ? "sem_permissao" : "sem_sinal");
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  }, []);

  useEffect(() => {
    enviar();
    const timer = setInterval(enviar, SEND_INTERVAL_MS);
    // Voltou pro app depois de um tempo: atualiza na hora, sem esperar o ciclo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") enviar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [enviar]);

  if (estado === "checando") return null;

  const ativo = estado === "compartilhando";
  const { titulo, detalhe } = TEXTO[estado];

  return (
    <div
      className={
        ativo
          ? "flex items-start gap-2.5 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5"
          : "flex items-start gap-2.5 border-b border-border/70 bg-muted/40 px-4 py-2.5"
      }
    >
      {ativo ? (
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <p
          className={
            ativo
              ? "text-xs font-semibold text-emerald-700 dark:text-emerald-300"
              : "text-xs font-semibold"
          }
        >
          {titulo}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}
