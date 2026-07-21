"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CallButton } from "@/components/leads/call-button";
import { WhatsAppCallButton } from "@/components/leads/whatsapp-call-button";
import { cancelAppointment } from "../agenda/actions";

type ScheduledCallRow = {
  id: string;
  lead_id: string | null;
  starts_at: string;
  notes: string | null;
  status: string;
  leads: { id: string; name: string; phone: string | null } | null;
};

export function ScheduledCallsPanel({ calls }: { calls: ScheduledCallRow[] }) {
  const [items, setItems] = useState(calls);

  function cancel(id: string) {
    setItems((prev) => prev.filter((c) => c.id !== id));
    void cancelAppointment({ id }).catch(() => null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-brand" /> Ligações agendadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ligação agendada.</p>}
        {items.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="min-w-0 flex-1">
              <Link href={c.lead_id ? `/chat/${c.lead_id}` : "#"} prefetch className="text-sm font-medium text-brand hover:underline">
                {c.leads?.name ?? "Lead"}
              </Link>
              {c.notes && <p className="truncate text-xs text-muted-foreground">{c.notes}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(c.starts_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {c.leads?.phone && (
                <>
                  <CallButton leadId={c.lead_id} phone={c.leads.phone} iconOnly />
                  <WhatsAppCallButton phone={c.leads.phone} iconOnly />
                </>
              )}
              <button type="button" onClick={() => cancel(c.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-destructive" title="Cancelar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
