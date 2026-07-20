"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { User, PanelRightOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CallButton } from "@/components/leads/call-button";
import { WhatsAppCallButton } from "@/components/leads/whatsapp-call-button";
import { CallLeadPanel } from "./call-lead-panel";
import { CALL_OUTCOME_LABEL, logCallOutcome, type CallOutcome } from "./actions";

type PipelineOption = { id: string; name: string; stages: { id: string; name: string; color: string | null; position: number | null }[] };

export type CallRow = {
  id: string;
  startedAt: string;
  from: string;
  to: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  pipelineName: string | null;
  stageName: string | null;
  attempts: number;
  ordinal: number;
  duration: number;
  wasAnswered: boolean;
  hangupLabel: string;
  recordUrl: string | null;
  outcome: CallOutcome;
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function CallsTable({
  calls,
  pipelineOptions,
  users,
}: {
  calls: CallRow[];
  pipelineOptions: PipelineOption[];
  users: { id: string; name: string }[];
}) {
  const [openLead, setOpenLead] = useState<{ id: string; name: string } | null>(null);
  const [, startTransition] = useTransition();
  const [localOutcome, setLocalOutcome] = useState<Record<string, CallOutcome>>({});

  function changeOutcome(call: CallRow, outcome: CallOutcome) {
    setLocalOutcome((prev) => ({ ...prev, [call.id]: outcome }));
    startTransition(() => {
      void logCallOutcome({ leadId: call.leadId ?? undefined, apiCallId: call.id, outcome }).catch(() => null);
    });
  }

  if (calls.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">Nenhuma ligação registrada ainda.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3">Destino</th>
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Funil</th>
              <th className="px-5 py-3">Etapa</th>
              <th className="px-5 py-3">Tentativas</th>
              <th className="px-5 py-3">Duração</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Resultado</th>
              <th className="px-5 py-3 text-center">Ações</th>
              <th className="px-5 py-3">Gravação</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                <td className="px-5 py-3 text-muted-foreground">
                  {new Date(c.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-5 py-3 font-mono">{c.to}</td>
                <td className="px-5 py-3">
                  {c.leadId ? (
                    <button
                      type="button"
                      onClick={() => setOpenLead({ id: c.leadId!, name: c.leadName ?? "Lead" })}
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      <User className="h-3.5 w-3.5" /> {c.leadName ?? "Ver lead"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="max-w-48 truncate text-muted-foreground">{c.pipelineName ?? "-"}</span>
                </td>
                <td className="px-5 py-3">
                  {c.stageName ? <Badge variant="outline">{c.stageName}</Badge> : <span className="text-muted-foreground">-</span>}
                </td>
                <td className="px-5 py-3">
                  <Badge variant="secondary" className="tabular-nums" title={`${c.attempts} tentativa(s) no total`}>
                    {c.ordinal}ª de {c.attempts}
                  </Badge>
                </td>
                <td className="px-5 py-3 tabular-nums">{formatDuration(c.duration)}</td>
                <td className="px-5 py-3">
                  <Badge variant={c.wasAnswered ? "success" : "destructive"}>{c.wasAnswered ? "Atendida" : c.hangupLabel}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Select value={localOutcome[c.id] ?? c.outcome} onValueChange={(v) => changeOutcome(c, v as CallOutcome)}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CALL_OUTCOME_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-center gap-1.5">
                    <CallButton leadId={c.leadId} phone={c.to} iconOnly />
                    <WhatsAppCallButton phone={c.leadPhone ?? c.to} iconOnly />
                    {c.leadId && (
                      <Button variant="outline" size="icon" title="Detalhes" onClick={() => setOpenLead({ id: c.leadId!, name: c.leadName ?? "Lead" })}>
                        <PanelRightOpen className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {c.recordUrl ? (
                    <a href={c.recordUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">Ouvir</a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openLead && (
        <CallLeadPanel
          leadId={openLead.id}
          leadName={openLead.name}
          onClose={() => setOpenLead(null)}
          pipelineOptions={pipelineOptions}
          users={users}
        />
      )}
    </>
  );
}
