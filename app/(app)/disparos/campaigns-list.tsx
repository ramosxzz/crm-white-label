"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, CircleX, Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cancelCampaign, getCampaignRecipients } from "./actions";

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  delay_seconds: number;
  created_at: string;
  total: number;
  sent: number;
  failed: number;
};

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "outline" | "destructive" | "secondary" }> = {
  running: { label: "Enviando", variant: "secondary" },
  completed: { label: "Concluida", variant: "success" },
  cancelled: { label: "Cancelada", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
  draft: { label: "Rascunho", variant: "outline" },
  scheduled: { label: "Agendada", variant: "outline" },
};

type Recipient = {
  id: string;
  phone: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  leads: { name: string } | null;
};

export function CampaignsList({ campaigns }: { campaigns: CampaignSummary[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setLoading(true);
    try {
      const data = await getCampaignRecipients(id);
      setRecipients(data);
    } finally {
      setLoading(false);
    }
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 py-16 text-center text-muted-foreground">
        <Megaphone className="mb-3 h-8 w-8" />
        <p className="text-sm">Nenhuma campanha criada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const statusMeta = STATUS_LABEL[c.status] ?? { label: c.status, variant: "outline" as const };
        const isExpanded = expanded === c.id;
        return (
          <div key={c.id} className="rounded-xl border border-border/70 bg-card/50">
            <button
              type="button"
              onClick={() => void toggleExpand(c.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.sent} enviadas · {c.failed} falharam · {c.total} no total · intervalo de {c.delay_seconds}s
                </p>
              </div>
              {c.status === "running" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    void cancelCampaign(c.id);
                  }}
                >
                  <CircleX className="h-3.5 w-3.5" /> Cancelar
                </Button>
              )}
            </button>

            {isExpanded && (
              <div className="border-t border-border/60 px-4 py-3">
                {loading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando destinatarios...
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recipients.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{r.leads?.name ?? r.phone}</span>
                        <span
                          className={
                            r.status === "sent"
                              ? "text-success"
                              : r.status === "failed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                          title={r.error ?? undefined}
                        >
                          {r.status === "sent" ? "Enviada" : r.status === "failed" ? "Falhou" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
