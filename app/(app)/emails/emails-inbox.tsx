"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { notify, notifyError } from "@/lib/ui/feedback";
import { listInboxAction, getThreadAction, sendReplyAction } from "./actions";
import type { InboxThreadSummary, GmailFullMessage } from "@/lib/google/gmail";

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

const EMAIL_FRAME_STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #1f2937;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  @media (prefers-color-scheme: dark) { body { color: #e5e7eb; } }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { max-width: 100%; }
  blockquote { margin: 0.5em 0; padding-left: 0.75em; border-left: 2px solid #d1d5db; color: #6b7280; }
  pre { white-space: pre-wrap; }
`;

/** Renderiza o HTML do email num iframe sandboxed - email de terceiro pode
 * trazer script/estilo hostil, nunca injeta direto na pagina (dangerouslySetInnerHTML). */
function EmailBodyFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(80);

  function resize() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    setHeight(doc.body.scrollHeight + 16);
  }

  return (
    <iframe
      ref={iframeRef}
      title="Conteudo do email"
      sandbox="allow-same-origin allow-popups"
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>${EMAIL_FRAME_STYLES}</style><base target="_blank"></head><body>${html}</body></html>`}
      onLoad={resize}
      style={{ width: "100%", height, border: "none", display: "block" }}
    />
  );
}

export function EmailsInbox({ accountEmail }: { accountEmail: string }) {
  const [threads, setThreads] = useState<InboxThreadSummary[] | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GmailFullMessage[] | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  function loadThreads() {
    setLoadingThreads(true);
    void listInboxAction()
      .then((result) => {
        if (!result.ok) {
          notifyError(new Error(result.error));
          setThreads([]);
          return;
        }
        setThreads(result.threads);
      })
      .catch((err) => {
        notifyError(err);
        setThreads([]);
      })
      .finally(() => setLoadingThreads(false));
  }

  useEffect(() => {
    loadThreads();
  }, []);

  function openThread(threadId: string) {
    setSelectedId(threadId);
    setMessages(null);
    setReplyBody("");
    setLoadingThread(true);
    void getThreadAction(threadId)
      .then((result) => {
        if (!result.ok) {
          notifyError(new Error(result.error));
          setMessages([]);
          return;
        }
        setMessages(result.messages);
      })
      .catch((err) => {
        notifyError(err);
        setMessages([]);
      })
      .finally(() => setLoadingThread(false));
  }

  function sendReply() {
    if (!selectedId || !messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    setSending(true);
    void sendReplyAction({
      threadId: selectedId,
      to: extractEmailAddress(last.from),
      subject: last.subject,
      inReplyTo: last.id,
      body: replyBody,
    })
      .then((result) => {
        if (!result.ok) {
          notifyError(new Error(result.error));
          return;
        }
        notify({ title: "Resposta enviada", tone: "success" });
        setReplyBody("");
        openThread(selectedId);
      })
      .catch((err) => notifyError(err))
      .finally(() => setSending(false));
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] border-t border-border/70">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Conectado</p>
            <p className="truncate text-sm font-medium">{accountEmail}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={loadThreads} disabled={loadingThreads}>
            <RefreshCw className={cn("h-4 w-4", loadingThreads && "animate-spin")} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads && !threads && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {threads?.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">Caixa de entrada vazia.</p>
          )}
          {threads?.map((t) => (
            <button
              key={t.threadId}
              onClick={() => openThread(t.threadId)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                selectedId === t.threadId && "bg-brand/10",
                t.unread && "bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("truncate text-sm", t.unread && "font-semibold")}>
                  {extractEmailAddress(t.from)}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {t.date ? new Date(t.date).toLocaleDateString("pt-BR") : ""}
                </span>
              </div>
              <span className={cn("truncate text-sm", t.unread ? "font-medium" : "text-muted-foreground")}>
                {t.subject || "(sem assunto)"}
              </span>
              <span className="truncate text-xs text-muted-foreground">{t.snippet}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Mail className="h-8 w-8" />
            <p className="text-sm">Selecione um email pra abrir.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingThread && (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {messages?.map((msg) => (
                <div key={msg.id} className="mb-4 rounded-lg border border-border/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{msg.from}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {msg.date ? new Date(msg.date).toLocaleString("pt-BR") : ""}
                    </span>
                  </div>
                  <EmailBodyFrame html={msg.bodyHtml} />
                </div>
              ))}
            </div>

            <div className="border-t border-border/70 p-4">
              <Textarea
                placeholder="Escreva sua resposta..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={4}
                disabled={sending}
              />
              <div className="mt-2 flex justify-end">
                <Button onClick={sendReply} disabled={sending || !replyBody.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Responder
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
