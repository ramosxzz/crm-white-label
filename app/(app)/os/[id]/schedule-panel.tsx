"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify, notifyError } from "@/lib/ui/feedback";
import type { FieldServiceUser } from "@/lib/field-service/users";
import { scheduleServiceOrder } from "../actions";

export function SchedulePanel({
  serviceOrderId,
  technicians,
  currentDate,
  currentShift,
  currentTechnicianIds,
}: {
  serviceOrderId: string;
  technicians: FieldServiceUser[];
  currentDate: string | null;
  currentShift: "manha" | "tarde" | null;
  currentTechnicianIds: string[];
}) {
  const [date, setDate] = useState(currentDate ?? "");
  const [shift, setShift] = useState<"manha" | "tarde">(currentShift ?? "manha");
  const [selected, setSelected] = useState<string[]>(currentTechnicianIds);
  const [pending, start] = useTransition();

  function toggleTechnician(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      notify({ title: "Escolha a data do atendimento", tone: "error" });
      return;
    }
    if (selected.length === 0) {
      notify({ title: "Escolha ao menos um técnico", tone: "error" });
      return;
    }
    start(async () => {
      try {
        await scheduleServiceOrder({
          id: serviceOrderId,
          service_date: date,
          shift,
          technician_ids: selected,
        });
        notify({ title: "OS agendada", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível agendar a OS");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <h2 className="text-sm font-semibold">Agendamento</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="service_date">Data</Label>
          <Input
            id="service_date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shift">Turno</Label>
          <select
            id="shift"
            value={shift}
            onChange={(e) => setShift(e.target.value as "manha" | "tarde")}
            className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
          >
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Técnicos</Label>
        {technicians.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum usuário com papel de técnico cadastrado. Cadastre em Configurações → Usuários.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {technicians.map((tech) => {
              const active = selected.includes(tech.id);
              return (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => toggleTechnician(tech.id)}
                  className={
                    active
                      ? "rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                      : "rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                  }
                >
                  {tech.name}
                </button>
              );
            })}
          </div>
        )}
        {selected.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Comissão do que for vendido em campo é dividida entre os {selected.length} técnicos.
          </p>
        )}
      </div>

      <Button type="submit" variant="brand" disabled={pending} className="w-full">
        <CalendarCheck className="h-4 w-4" />
        {pending ? "Salvando..." : currentDate ? "Atualizar agendamento" : "Agendar OS"}
      </Button>
    </form>
  );
}
