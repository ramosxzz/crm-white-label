"use client";

import { useEffect, useState } from "react";
import { listLeadTimeline, type LeadTimelineEntry } from "@/app/(app)/chat/actions";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function describeEntry(entry: LeadTimelineEntry): string {
  const p = entry.payload;
  const by = entry.userName ? ` · ${entry.userName}` : "";
  switch (entry.kind) {
    case "stage_changed":
      return `Etapa alterada de "${p.from_stage_name ?? "sem etapa"}" para "${p.to_stage_name ?? "sem etapa"}"${by}`;
    case "assigned":
      return p.unassigned ? `Devolvido para a fila${by}` : `Atribuído a ${p.to_user_name ?? "alguém"}${by}`;
    case "tag_added":
      return `Tag adicionada: ${p.tag}${by}`;
    case "tag_removed":
      return `Tag removida: ${p.tag}${by}`;
    case "meeting_scheduled":
      return `Reunião agendada para ${p.starts_at ? formatDateTime(String(p.starts_at)) : "?"}${by}`;
    case "call_scheduled":
      return `Ligação agendada para ${p.starts_at ? formatDateTime(String(p.starts_at)) : "?"}${by}`;
    case "message_scheduled":
      return `Mensagem agendada para ${p.send_at ? formatDateTime(String(p.send_at)) : "?"}${by}`;
    case "meeting_status_changed":
      return `Reunião marcada como "${statusLabel(String(p.status))}"${by}`;
    case "call_status_changed":
      return `Ligação agendada marcada como "${statusLabel(String(p.status))}"${by}`;
    case "meeting_outcome":
      return `Resultado da reunião: ${outcomeLabel(String(p.outcome))}${by}`;
    case "call_outcome":
      return `Resultado da ligação agendada: ${outcomeLabel(String(p.outcome))}${by}`;
    case "call_logged":
      return `Ligação registrada: ${p.outcome_label ?? p.outcome}${by}`;
    default:
      return `${entry.kind}${by}`;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = { confirmed: "confirmada", completed: "concluída", cancelled: "cancelada", no_show: "não compareceu" };
  return map[status] ?? status;
}

function outcomeLabel(outcome: string) {
  const map: Record<string, string> = {
    pending: "pendente",
    no_show: "não compareceu",
    done: "realizada",
    closed_on_call: "fechou na hora",
    closed_later: "fechou depois",
  };
  return map[outcome] ?? outcome;
}

export function LeadTimeline({ leadId }: { leadId: string }) {
  const [entries, setEntries] = useState<LeadTimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    listLeadTimeline(leadId)
      .then((data) => !cancelled && setEntries(data))
      .catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  return (
    <div>
      {entries === null && <p className="text-xs text-muted-foreground">Carregando...</p>}
      {entries?.length === 0 && <p className="text-xs text-muted-foreground">Nenhum evento registrado ainda.</p>}
      {entries && entries.length > 0 && (
        <ol className="space-y-2.5 border-l border-border/60 pl-3">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[15px] top-1 h-2 w-2 rounded-full bg-brand" />
              <p className="text-xs leading-snug">{describeEntry(entry)}</p>
              <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
