"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listLeadGmailMessages } from "../actions";
import { notifyError } from "@/lib/ui/feedback";
import type { GmailMessageSummary } from "@/lib/google/gmail";

export function LeadEmailsPanel({ leadId, googleConnected }: { leadId: string; googleConnected: boolean }) {
  const [messages, setMessages] = useState<GmailMessageSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    void listLeadGmailMessages(leadId)
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
      .finally(() => setLoading(false));
  }

  if (!googleConnected) {
    return (
      <p className="text-sm text-muted-foreground">
        Conecte o{" "}
        <Link href="/integrations/gmail" className="text-brand underline">
          Gmail
        </Link>{" "}
        pra ver os emails trocados com esse lead aqui.
      </p>
    );
  }

  if (messages === null) {
    return (
      <Button variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
        Carregar emails
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Atualizar
      </Button>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum email encontrado com esse lead.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className="rounded-md border border-border/70 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{msg.subject || "(sem assunto)"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {msg.date ? new Date(msg.date).toLocaleDateString("pt-BR") : ""}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">De: {msg.from}</p>
              <p className="mt-1 text-muted-foreground">{msg.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
