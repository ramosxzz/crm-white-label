"use client";

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

/** Aviso (toast) com o visual do CRM. */
export function notify(options: NotifyOptions) {
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
