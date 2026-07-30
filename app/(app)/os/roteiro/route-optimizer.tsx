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
  reason,
}: {
  serviceDate: string;
  shift: "manha" | "tarde";
  technicianId: string;
  disabled?: boolean;
  /** Por que o botao esta desligado. Some quando da pra otimizar. */
  reason?: string;
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

        // Dizer explicitamente SE a ordem mudou. Antes a mensagem so trazia
        // distancia e tempo: quem clicava via numeros iguais na tela e
        // concluia que o botao nao tinha feito nada.
        const trajeto = `${result.distanceLabel} de trajeto, ${result.durationLabel} dirigindo.`;
        notify({
          title: result.changed
            ? `Ordem das visitas alterada (${result.optimized} paradas)`
            : "A ordem que já estava é a melhor possível",
          description: [
            result.changed ? `Nova sequência: ${result.sequence.join(" → ")}` : trajeto,
            result.skipped > 0
              ? `${result.skipped} OS ficaram de fora por endereço incompleto.`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
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
      {!summary && reason && (
        // Botao que some sozinho e recurso que ninguem descobre: quando nao da
        // pra otimizar, ele fica visivel e desligado, explicando o porque.
        <p className="text-center text-[11px] leading-snug text-muted-foreground">{reason}</p>
      )}
    </div>
  );
}
