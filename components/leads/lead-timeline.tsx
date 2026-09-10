"use client";

import { useEffect, useState } from "react";
import { listLeadTimeline, type LeadTimelineEntry } from "@/app/(app)/chat/actions";
import { formatBRTDateTime as formatDateTime } from "@/lib/date/brt";
import { formatCurrencyBRL } from "@/lib/utils";

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
    case "message": {
      const direction = p.direction === "inbound" ? "recebida" : "enviada";
      const content = p.body
        ? `: ${preview(String(p.body))}`
        : p.media_type
          ? ` (${mediaLabel(String(p.media_type))})`
          : "";
      const status = p.status === "failed" ? " · falhou" : "";
      return `Mensagem ${direction}${content}${status}${by}`;
    }
    case "task": {
      const status = taskStatusLabel(String(p.status ?? "open"));
      const due = p.due_at ? ` · prazo ${formatDateTime(String(p.due_at))}` : "";
      return `Tarefa: ${p.title ?? "Sem título"} · ${status}${due}${by}`;
    }
    case "appointment": {
      const kind = p.appointment_kind === "call" ? "Ligação" : "Reunião";
      const when = p.starts_at ? formatDateTime(String(p.starts_at)) : "sem data";
      return `${kind}: ${when} · ${statusLabel(String(p.status ?? "scheduled"))}${by}`;
    }
    case "file":
      return `Arquivo anexado: ${p.name ?? "arquivo"}${by}`;
    case "value_item":
      return `Valor adicionado: ${p.label ?? "Item"} · ${formatCurrencyBRL(Number(p.amount_cents ?? 0))}${by}`;
    case "payment": {
      const kind = p.entry_kind === "expense" ? "Despesa" : "Recebimento";
      const order = p.service_order_code ? ` · OS #${p.service_order_code}` : "";
      const status = p.paid_at ? "pago" : String(p.status ?? "pendente");
      return `${kind}: ${formatCurrencyBRL(Number(p.amount_cents ?? 0))} · ${status}${order}${by}`;
    }
    case "automation_execution": {
      const failed = p.status === "failed" ? " · falhou" : "";
      return `${p.flow_name ?? "Automação"} executada${failed}`;
    }
    default:
      return `${entry.kind}${by}`;
  }
}

function preview(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 90 ? `${compact.slice(0, 87)}...` : compact;
}

function mediaLabel(mediaType: string) {
  if (mediaType.includes("audio")) return "áudio";
  if (mediaType.includes("image")) return "imagem";
  if (mediaType.includes("video")) return "vídeo";
  return "arquivo";
}

function taskStatusLabel(status: string) {
  const map: Record<string, string> = { open: "aberta", done: "concluída", cancelled: "cancelada" };
  return map[status] ?? status;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: "agendada",
    confirmed: "confirmada",
    completed: "concluída",
    cancelled: "cancelada",
    no_show: "não compareceu",
  };
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
