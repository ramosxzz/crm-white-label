"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "solaire-install-dismissed";

/**
 * Convite pra instalar o app com icone na tela inicial.
 *
 * Existe pelo tecnico: ele trabalha o dia todo nessa tela e pediu app com
 * icone, nao aba de navegador. O Chrome so dispara beforeinstallprompt uma
 * vez por sessao, entao guardamos o evento pra usar quando ele clicar.
 */
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // storage bloqueado: mostra assim mesmo.
    }

    // Ja rodando instalado: nao ha o que oferecer.
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function onInstalled() {
      setVisible(false);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // sem storage o convite volta na proxima visita; aceitavel.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  }

  if (!visible || !deferred) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] flex items-center gap-3 rounded-xl border border-border/70 bg-card/95 p-3 shadow-elev-2 backdrop-blur-xl sm:left-auto sm:right-4 sm:w-80">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Instalar o app</p>
        <p className="text-xs text-muted-foreground">
          Abre com ícone, tela cheia e funciona melhor fora de área.
        </p>
      </div>
      <Button type="button" size="sm" variant="brand" onClick={install}>
        <Download className="h-3.5 w-3.5" /> Instalar
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
