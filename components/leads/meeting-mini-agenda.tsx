"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { notifyError } from "@/lib/ui/feedback";
import { getMeetingDayAvailability, type MeetingDayAvailability } from "./schedule-meeting-action";

function brtToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Mostra quem ja tem reuniao/ligacao marcada num dia, antes de escolher o
 * horario - hoje o form de agendar reuniao insere cego, sem mostrar nenhum
 * compromisso existente. Mesmo padrao do MiniAgenda de tecnicos
 * (app/(app)/os/mini-agenda.tsx), so que em cima de appointments/responsavel.
 */
export function MeetingMiniAgenda({
  selectedUserId,
  onPickDateAndUser,
}: {
  selectedUserId: string;
  onPickDateAndUser: (date: string, userId: string) => void;
}) {
  const [date, setDate] = useState(brtToday());
  const [rows, setRows] = useState<MeetingDayAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setRows([]);
      return;
    }
    setLoading(true);
    getMeetingDayAvailability(date)
      .then(setRows)
      .catch((err) => {
        notifyError(err, "Não foi possível carregar a agenda");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-brand" /> Ver agenda do dia
        </p>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 w-40"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const selected = selectedUserId === row.userId;
            return (
              <li key={row.userId}>
                <button
                  type="button"
                  onClick={() => onPickDateAndUser(date, row.userId)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "border-brand bg-brand/10"
                      : "border-border/60 bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.busy.length === 0 ? "dia livre" : `${row.busy.length} marcado(s)`}
                    </span>
                  </div>
                  {row.busy.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.busy.map((b, i) => (
                        <span
                          key={i}
                          className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          title={b.leadName}
                        >
                          {hhmm(b.startAt)}–{hhmm(b.endAt)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
