"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify, notifyError } from "@/lib/ui/feedback";
import { setServiceOrderTechnicians } from "../actions";
import { suggestTechnicianForOrder, type TechnicianSuggestionResult } from "../routing-actions";

/**
 * Inclusao de ultima hora: mostra qual tecnico do turno absorve a parada nova
 * com o menor desvio de rota, e deixa alocar direto dali.
 */
export function TechnicianSuggester({
  serviceOrderId,
  serviceDate,
  shift,
}: {
  serviceOrderId: string;
  serviceDate: string;
  shift: "manha" | "tarde";
}) {
  const [pending, start] = useTransition();
  const [suggestions, setSuggestions] = useState<TechnicianSuggestionResult[] | null>(null);

  function ask() {
    start(async () => {
      try {
        const result = await suggestTechnicianForOrder({
          service_order_id: serviceOrderId,
          service_date: serviceDate,
          shift,
        });
        if (result.length === 0) {
          notify({ title: "Nenhum tecnico disponivel nesse turno", tone: "info" });
          return;
        }
        setSuggestions(result);
      } catch (error) {
        notifyError(error, "Nao foi possivel sugerir tecnico");
      }
    });
  }

  function assign(technicianId: string, technicianName: string) {
    start(async () => {
      try {
        await setServiceOrderTechnicians({
          id: serviceOrderId,
          technician_ids: [technicianId],
        });
        notify({ title: `OS atribuida a ${technicianName}`, tone: "success" });
        setSuggestions(null);
      } catch (error) {
        notifyError(error, "Nao foi possivel atribuir o tecnico");
      }
    });
  }

  if (!suggestions) {
    return (
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={ask}>
        <Sparkles className="h-3.5 w-3.5" />
        {pending ? "Calculando..." : "Sugerir tecnico"}
      </Button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border/70 bg-background/40 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Menor desvio de rota
      </p>
      {suggestions.slice(0, 4).map((item, index) => (
        <button
          key={item.technicianId}
          type="button"
          disabled={pending}
          onClick={() => assign(item.technicianId, item.technicianName)}
          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-brand/10 disabled:opacity-60"
        >
          <span className={index === 0 ? "font-semibold text-brand" : "font-medium"}>
            {item.technicianName}
          </span>
          <span className="text-muted-foreground">
            +{item.extraLabel} · {item.stopCount} parada(s)
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setSuggestions(null)}
        className="w-full pt-1 text-center text-[11px] text-muted-foreground hover:text-foreground"
      >
        fechar
      </button>
    </div>
  );
}
