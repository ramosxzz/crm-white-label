"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { registerFeedbackHandlers } from "@/lib/ui/feedback";

/**
 * Substitui window.confirm/window.alert, que no navegador aparecem como
 * "crm.seudominio.com.br diz: ..." - quebrando o white-label (mostra o
 * dominio real da plataforma pro cliente final) e sem qualquer identidade
 * visual. Aqui tudo usa o tema/marca do tenant.
 */

type ConfirmTone = "default" | "danger";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type NotifyTone = "success" | "error" | "info";

type NotifyOptions = {
  title: string;
  description?: string;
  tone?: NotifyTone;
};

type Toast = NotifyOptions & { id: number };

type FeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (options: NotifyOptions) => void;
};

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

const TOAST_DURATION_MS = 5000;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = React.useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);
  const [pending, setPending] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toastId = React.useRef(0);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const notify = React.useCallback((options: NotifyOptions) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { ...options, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const value = React.useMemo(() => ({ confirm, notify }), [confirm, notify]);

  React.useEffect(() => {
    registerFeedbackHandlers(value);
  }, [value]);

  function settle(result: boolean) {
    confirmState?.resolve(result);
    setConfirmState(null);
    setPending(false);
  }

  const isDanger = confirmState?.tone === "danger";

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <Dialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open && !pending) settle(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                  isDanger ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand",
                )}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <DialogTitle>{confirmState?.title}</DialogTitle>
                {confirmState?.description && (
                  // whitespace-pre-line: o resumo de comissao no faturamento manda uma
                  // linha por beneficiario: sem isso as quebras colapsavam num paragrafo
                  // so. Nao muda nada pra descricao de uma linha so (o caso comum).
                  <DialogDescription className="mt-1.5 whitespace-pre-line">
                    {confirmState.description}
                  </DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => settle(false)} disabled={pending}>
              {confirmState?.cancelLabel ?? "Cancelar"}
            </Button>
            <Button
              variant={isDanger ? "destructive" : "brand"}
              onClick={() => {
                setPending(true);
                settle(true);
              }}
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmState?.confirmLabel ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-2"
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : toast.tone === "error" ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = React.useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback precisa estar dentro de <FeedbackProvider>");
  return ctx;
}
