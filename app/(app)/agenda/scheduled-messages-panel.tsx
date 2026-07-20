"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelScheduledMessage } from "../chat/actions";

type ScheduledMessageRow = {
  id: string;
  lead_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  send_at: string;
  status: string;
  leads: { id: string; name: string; phone: string | null } | null;
};

export function ScheduledMessagesPanel({ messages }: { messages: ScheduledMessageRow[] }) {
  const [items, setItems] = useState(messages);

  function cancel(id: string, leadId: string) {
    setItems((prev) => prev.filter((m) => m.id !== id));
    void cancelScheduledMessage({ id, leadId }).catch(() => null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand" /> Mensagens agendadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem agendada.</p>}
        {items.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="min-w-0 flex-1">
              <Link href={`/chat/${m.lead_id}`} prefetch className="text-sm font-medium text-brand hover:underline">
                {m.leads?.name ?? "Lead"}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{m.body ?? "Mídia"}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(m.send_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <button type="button" onClick={() => cancel(m.id, m.lead_id)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-destructive" title="Cancelar">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
