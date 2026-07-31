"use client";

import { notifyError } from "@/lib/ui/feedback";
import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getLeadChatThread, sendChatMessage } from "@/app/(app)/chat/actions";

type Message = {
  id: string;
  body: string | null;
  direction: "inbound" | "outbound";
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
};

export function MiniChatPanel({
  leadId,
  leadName,
  onClose,
  embedded = false,
}: {
  leadId: string;
  leadName: string;
  onClose: () => void;
  /** Sem overlay/backdrop proprio - pra embutir dentro de outro painel ja flutuante. */
  embedded?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getLeadChatThread(leadId).then((data) => {
      if (cancelled) return;
      setConversationId(data.conversationId);
      setMessages(data.messages as Message[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`mini-chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => prev.map((message) => (message.id === row.id ? { ...message, ...row } : message)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const value = body.trim();
    if (!value || sending) return;
    setSending(true);
    setBody("");
    try {
      const result = await sendChatMessage({ leadId, body: value });
      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.message as Message]);
    } catch (err) {
      notifyError(err, "Nao foi possivel enviar a mensagem.");
      setBody(value);
    } finally {
      setSending(false);
    }
  }

  const content = (
    <div className={cn("flex flex-col bg-card", embedded ? "h-80 rounded-lg border border-border/60" : "h-full w-full max-w-sm shadow-xl")}>
      {!embedded && (
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h3 className="truncate text-base font-semibold">{leadName}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading && <p className="text-sm text-muted-foreground">Carregando conversa...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda. Envie a primeira abaixo.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                m.direction === "outbound" ? "bg-brand text-brand-foreground" : "bg-muted text-foreground",
              )}
            >
              {m.deleted_at ? (
                <span className="italic opacity-75">Mensagem apagada</span>
              ) : (
                <>
                  {m.body || (m.media_url ? "[mídia]" : "")}
                  {m.edited_at && <span className="ml-1 text-[10px] italic opacity-70">editada</span>}
                </>
              )}
              <div className="mt-1 text-[10px] opacity-70">
                {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Mensagem..."
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-brand"
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !body.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative flex h-full">{content}</div>
    </div>
  );
}
