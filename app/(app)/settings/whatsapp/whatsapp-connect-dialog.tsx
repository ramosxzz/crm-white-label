"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, QrCode, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { notify, notifyError } from "@/lib/ui/feedback";
import { requestWhatsAppConnectQr, checkWhatsAppConnectionStatus } from "./actions";

// O QR da Evolution expira rapido - pede um novo antes que o cliente
// escaneie um QR ja vencido sem entender por que nao funcionou.
const QR_REFRESH_MS = 25_000;
const POLL_MS = 3_000;

/**
 * Autoatendimento de conexao: mostra o QR direto no painel, sem o cliente
 * precisar entrar no Manager da Evolution (que exigiria dar a api_key pra
 * ele). Fica esperando o status virar "conectado" sozinho - o cliente so
 * escaneia e espera.
 */
export function WhatsAppConnectDialog({
  accountId,
  displayName,
  trigger,
}: {
  accountId: string;
  displayName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<{ base64: string | null; pairingCode: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimers() {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    qrTimerRef.current = null;
    pollTimerRef.current = null;
  }

  async function fetchQr() {
    setError(null);
    try {
      const result = await requestWhatsAppConnectQr({ id: accountId });
      setQr(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o QR");
    }
  }

  async function pollStatus() {
    try {
      const status = await checkWhatsAppConnectionStatus({ id: accountId });
      if (status.connected) {
        setConnected(true);
        clearTimers();
        notify({ title: `${displayName} conectado`, tone: "success" });
        router.refresh();
      }
    } catch {
      // Poll falhar uma vez nao e motivo pra parar - so tenta de novo no
      // proximo ciclo.
    }
  }

  useEffect(() => {
    if (!open) {
      clearTimers();
      setQr(null);
      setConnected(false);
      setError(null);
      return;
    }

    setLoading(true);
    void fetchQr().finally(() => setLoading(false));
    qrTimerRef.current = setInterval(fetchQr, QR_REFRESH_MS);
    pollTimerRef.current = setInterval(pollStatus, POLL_MS);

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Conectar {displayName}</DialogTitle>
          <DialogDescription>Abra o WhatsApp no celular do número, vá em Aparelhos conectados e escaneie o QR.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {connected ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
              <p className="text-sm font-medium">Conectado com sucesso</p>
            </div>
          ) : loading && !qr ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Gerando QR...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchQr()}>
                <RotateCw className="h-3.5 w-3.5" /> Tentar de novo
              </Button>
            </div>
          ) : qr?.base64 ? (
            <>
              <div className="rounded-lg border border-border/70 bg-white p-2">
                <img
                  src={qr.base64.startsWith("data:") ? qr.base64 : `data:image/png;base64,${qr.base64}`}
                  alt="QR Code do WhatsApp"
                  className="h-56 w-56"
                />
              </div>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <QrCode className="h-3.5 w-3.5" /> O QR se renova sozinho a cada 25s
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <p className="text-sm">Nenhum QR disponível.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void fetchQr()}>
                <RotateCw className="h-3.5 w-3.5" /> Gerar QR
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
