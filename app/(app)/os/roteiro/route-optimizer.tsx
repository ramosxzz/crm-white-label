"use client";

import { useState, useTransition } from "react";
import { Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify, notifyError } from "@/lib/ui/feedback";
import { optimizeShiftRoute } from "../routing-actions";

/**
 * Otimizacao e por botao, nao automatica: cada clique e uma chamada paga da
 * API do Google, entao quem decide quando vale a pena e o ADM.
 */
export function RouteOptimizer({
  serviceDate,
  shift,
  technicianId,
  disabled,
}: {
  serviceDate: string;
  shift: "manha" | "tarde";
  technicianId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<string | null>(null);

  function run() {
    start(async () => {
      try {
        const result = await optimizeShiftRoute({
          service_date: serviceDate,
          shift,
          technician_id: technicianId,
        });
        if (result.optimized === 0) {
          notify({ title: "Nada pra otimizar nesse turno", tone: "info" });
          return;
        }
        setSummary(`${result.distanceLabel} · ${result.durationLabel}`);
        notify({
          title: `Rota otimizada: ${result.optimized} parada(s)`,
          description:
            result.skipped > 0
              ? `${result.skipped} OS ficaram de fora por endereco incompleto.`
              : `${result.distanceLabel} de trajeto, ${result.durationLabel} dirigindo.`,
          tone: "success",
        });
      } catch (error) {
        notifyError(error, "Nao foi possivel otimizar a rota");
      }
    });
  }

  return (
    <div className="mt-3 space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={pending || disabled}
        onClick={run}
      >
        <Route className="h-3.5 w-3.5" />
        {pending ? "Calculando..." : "Otimizar rota"}
      </Button>
      {summary && <p className="text-center text-[11px] text-muted-foreground">{summary}</p>}
    </div>
  );
}
