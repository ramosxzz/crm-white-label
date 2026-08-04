"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { ChatThread } from "@/app/(app)/chat/[leadId]/chat-thread";
import { getChatThreadData } from "@/app/(app)/chat/[leadId]/get-thread-data";

type ChatThreadData = Awaited<ReturnType<typeof getChatThreadData>>;

/**
 * Miniatura completa do conversador (mesmo componente da pagina /chat/[leadId],
 * com todas as funcionalidades: mensagens rapidas, midia, agendar, notas, tags,
 * estrelas, negocio) dentro de um painel flutuante - usada no Kanban pra
 * responder o lead sem sair da tela.
 */
export function ChatThreadOverlay({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [data, setData] = useState<ChatThreadData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getChatThreadData(leadId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message || "Nao foi possivel carregar a conversa.");
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      {/* O painel de detalhes do lead (dentro do ChatThread) usa
          `position: fixed` pra virar gaveta em telas estreitas - certo na
          pagina cheia /chat/[leadId] (fixed = janela), mas aqui dentro do
          modal isso escapava do recorte arredondado do card e ficava colado
          na borda real do navegador em vez da borda do modal, cortando
          visualmente o painel. `transform` no card cria um novo bloco de
          referencia pra "fixed", prendendo a gaveta dentro do modal. */}
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl [transform:translateZ(0)] sm:h-[92vh]">
        <div className="flex shrink-0 items-center justify-end border-b border-border/50 bg-card/78 px-3 py-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && !data && (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa...
          </div>
        )}

        {!error && data && (
          <div className="flex min-h-0 flex-1">
            <ChatThread {...data} />
          </div>
        )}
      </div>
    </div>
  );
}
