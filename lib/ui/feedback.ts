"use client";

import { isStaleDeploymentMessage } from "@/lib/stale-deployment";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

export type NotifyOptions = {
  title: string;
  description?: string;
  tone?: "success" | "error" | "info";
};

type Handlers = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (options: NotifyOptions) => void;
};

// O FeedbackProvider registra os handlers reais ao montar. Exposto como
// modulo (e nao so como hook) pra poder trocar window.confirm/window.alert
// em qualquer lugar sem reestruturar componentes grandes.
let handlers: Handlers | null = null;

export function registerFeedbackHandlers(next: Handlers) {
  handlers = next;
}

/** Confirmacao com o visual do CRM. Fallback pro confirm nativo se o provider ainda nao montou. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!handlers) {
    return Promise.resolve(
      typeof window !== "undefined"
        ? window.confirm([options.title, options.description].filter(Boolean).join("\n\n"))
        : false,
    );
  }
  return handlers.confirm(options);
}

const STALE_RELOAD_KEY = "solaire:stale-reload-at";
const STALE_RELOAD_COOLDOWN_MS = 10_000;

/**
 * Depois de um deploy, uma aba aberta guarda a referencia antiga da Server
 * Action ou de um chunk que o build novo substituiu - o servidor recusa com
 * uma mensagem tecnica ("Failed to find Server Action...", "ChunkLoadError"
 * etc). Isso ja era tratado quando o erro subia ate o error boundary
 * (app/(app)/error.tsx), mas a maioria das acoes do app captura o erro
 * localmente e so mostra um toast - nesse caminho o usuario via o erro cru
 * sem saber que so precisava recarregar a pagina.
 *
 * Centralizado aqui, no `notify()`, em vez de em cada chamada de
 * notifyError/catch: e o funil por onde todo toast de erro passa, entao
 * cobre qualquer tela, atual ou futura, sem precisar caçar cada lugar.
 */
function tryAutoReloadOnStaleDeployment(options: NotifyOptions): boolean {
  if (typeof window === "undefined") return false;
  if (options.tone !== "error") return false;
  if (!isStaleDeploymentMessage(options.title) && !isStaleDeploymentMessage(options.description)) return false;

  try {
    const last = Number(window.sessionStorage.getItem(STALE_RELOAD_KEY) ?? 0);
    const now = Date.now();
    if (now - last <= STALE_RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(STALE_RELOAD_KEY, String(now));
  } catch {
    return false;
  }

  notify({ title: "O sistema foi atualizado", description: "Recarregando a página...", tone: "info" });
  window.setTimeout(() => window.location.reload(), 700);
  return true;
}

/** Aviso (toast) com o visual do CRM. */
export function notify(options: NotifyOptions) {
  if (tryAutoReloadOnStaleDeployment(options)) return;

  if (!handlers) {
    if (typeof window !== "undefined") {
      window.alert([options.title, options.description].filter(Boolean).join("\n\n"));
    }
    return;
  }
  handlers.notify(options);
}

/** Atalho pros casos de "deu erro, mostra a mensagem" (o padrao antigo com alert). */
export function notifyError(error: unknown, fallback = "Nao foi possivel concluir a acao.") {
  const message =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error
        ? error
        : fallback;
  notify({ title: message, tone: "error" });
}
