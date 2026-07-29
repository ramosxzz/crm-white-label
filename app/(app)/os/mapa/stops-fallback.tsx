"use client";

import Link from "next/link";
import { MapPin, MonitorX } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
} from "@/lib/field-service/status";
import type { MapStop, MapTechnician } from "./types";

/**
 * Mostrado quando o mapa nao pode ser desenhado (sem WebGL2 ou falha na GPU).
 * Nao e uma tela de erro: e a mesma informacao do mapa em lista, na ordem da
 * rota, pra quem esta no administrativo nao ficar sem poder trabalhar.
 */
export function StopsFallback({
  stops,
  technicians,
  colorByTechnician,
  reason,
}: {
  stops: MapStop[];
  technicians: MapTechnician[];
  colorByTechnician: Record<string, string>;
  reason: "webgl" | "error";
}) {
  const nameById = new Map(technicians.map((tech) => [tech.id, tech.name]));

  const ordered = [...stops].sort((a, b) => {
    if (a.shift !== b.shift) return a.shift === "manha" ? -1 : 1;
    return (a.routePosition ?? 999) - (b.routePosition ?? 999);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-border/70 bg-muted/30 px-5 py-4">
        <MonitorX className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-medium">
            {reason === "webgl"
              ? "Este computador não consegue desenhar o mapa"
              : "O mapa não pôde ser carregado"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {reason === "webgl" ? (
              <>
                O mapa precisa de aceleração gráfica, que está desligada ou indisponível neste
                navegador. Costuma resolver ativando a aceleração de hardware nas configurações do
                navegador e reabrindo a página. As paradas do dia estão listadas abaixo, na ordem
                da rota.
              </>
            ) : (
              <>
                As paradas do dia estão listadas abaixo, na ordem da rota. Recarregar a página
                costuma resolver.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {ordered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhuma parada nesse filtro.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {ordered.map((stop) => {
              const primary = stop.technicianIds[0];
              const color = (primary && colorByTechnician[primary]) || "#64748b";
              const names = stop.technicianIds
                .map((id) => nameById.get(id))
                .filter(Boolean)
                .join(" + ");
              return (
                <li key={stop.id}>
                  <Link
                    href={`/os/${stop.id}`}
                    className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-background text-[11px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      {stop.routePosition ?? "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{stop.leadName}</span>
                        <span className="text-xs text-muted-foreground">
                          {stop.code}
                          {stop.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[stop.shift]}` : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        {stop.address}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {names || "Sem técnico alocado"} ·{" "}
                        {SERVICE_ORDER_STATUS_LABEL[stop.status]}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">
                      {formatCurrencyBRL(stop.totalCents)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
