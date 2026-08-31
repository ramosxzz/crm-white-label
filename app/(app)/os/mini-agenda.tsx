"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { notifyError } from "@/lib/ui/feedback";
import { getTechnicianDayAvailability, type TechnicianDayAvailability } from "./actions";

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

export type MiniAgendaSelection = {
  date: string;
  technicianId: string;
  technicianName: string;
  startTime: string;
  endTime: string;
};

/**
 * Agenda enxuta dentro do modal de nova OS: a vendedora fecha a venda pelo
 * chat e precisa ver o horario livre do tecnico ali mesmo - ela nao tem
 * acesso a Agenda cheia (que e operacao de campo).
 */
export function MiniAgenda({
  value,
  onChange,
}: {
  value: MiniAgendaSelection | null;
  onChange: (selection: MiniAgendaSelection | null) => void;
}) {
  const [date, setDate] = useState(value?.date ?? brtToday());
  const [rows, setRows] = useState<TechnicianDayAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Input type="date" passa valor vazio/incompleto enquanto o usuario
      // ta editando o campo - so busca quando a data ficar completa.
      setRows([]);
      return;
    }
    setLoading(true);
    getTechnicianDayAvailability(date)
      .then(setRows)
      .catch((err) => {
        notifyError(err, "Não foi possível carregar a agenda");
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [date]);

  function pickTechnician(tech: TechnicianDayAvailability) {
    onChange({
      date,
      technicianId: tech.technicianId,
      technicianName: tech.technicianName,
      startTime: value?.startTime ?? "09:00",
      endTime: value?.endTime ?? "10:00",
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-brand" /> Agenda dos técnicos
        </p>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            onChange(null);
          }}
          className="h-8 w-40"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhum técnico cadastrado.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((tech) => {
            const selected = value?.technicianId === tech.technicianId;
            return (
              <li key={tech.technicianId}>
                <button
                  type="button"
                  onClick={() => pickTechnician(tech)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    selected
                      ? "border-brand bg-brand/10"
                      : "border-border/60 bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{tech.technicianName}</span>
                    <span className="text-xs text-muted-foreground">
                      {tech.busy.length === 0 ? "dia livre" : `${tech.busy.length} agendado(s)`}
                    </span>
                  </div>
                  {tech.busy.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tech.busy.map((b, i) => (
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

      {value && (
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="mini_start">Início com {value.technicianName}</Label>
            <Input
              id="mini_start"
              type="time"
              value={value.startTime}
              onChange={(e) => onChange({ ...value, startTime: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mini_end">Fim</Label>
            <Input
              id="mini_end"
              type="time"
              value={value.endTime}
              onChange={(e) => onChange({ ...value, endTime: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
