"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supportsWebGL2 } from "@/lib/browser/webgl";
import { MapBoundary } from "./map-boundary";
import { StopsFallback } from "./stops-fallback";
import {
  technicianColor,
  type MapBase,
  type MapStop,
  type MapTechnician,
  type TechnicianPosition,
} from "./types";

// MapLibre so roda no browser e pesa: fora do bundle do servidor e carregado
// so quando esta tela abre.
const MapCanvas = dynamic(() => import("./map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-sm text-muted-foreground">
      Carregando mapa...
    </div>
  ),
});

const SHIFT_FILTERS = [
  { value: "todos", label: "Dia inteiro" },
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
] as const;

type ShiftFilter = (typeof SHIFT_FILTERS)[number]["value"];

export function TechniciansMap({
  stops,
  technicians,
  base,
  positions = [],
}: {
  stops: MapStop[];
  technicians: MapTechnician[];
  base: MapBase | null;
  positions?: TechnicianPosition[];
}) {
  const [shift, setShift] = useState<ShiftFilter>("todos");
  const [activeTechnician, setActiveTechnician] = useState<string | null>(null);
  // null enquanto nao checou: a checagem so roda no browser, entao no primeiro
  // render (servidor e hidratacao) ainda nao da pra saber.
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);

  useEffect(() => {
    setHasWebGL(supportsWebGL2());
  }, []);

  const colorByTechnician = useMemo(
    () =>
      Object.fromEntries(technicians.map((tech, index) => [tech.id, technicianColor(index)])),
    [technicians],
  );

  const visibleStops = useMemo(
    () =>
      stops.filter((stop) => {
        if (shift !== "todos" && stop.shift !== shift) return false;
        if (activeTechnician && !stop.technicianIds.includes(activeTechnician)) return false;
        return true;
      }),
    [stops, shift, activeTechnician],
  );

  const visiblePositions = useMemo(
    () =>
      positions.filter(
        (p) => !activeTechnician || p.technicianId === activeTechnician,
      ),
    [positions, activeTechnician],
  );

  const visibleTechnicians = useMemo(
    () => (activeTechnician ? technicians.filter((t) => t.id === activeTechnician) : technicians),
    [technicians, activeTechnician],
  );

  function countFor(technicianId: string) {
    return stops.filter(
      (stop) =>
        stop.technicianIds.includes(technicianId) &&
        (shift === "todos" || stop.shift === shift),
    ).length;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {SHIFT_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setShift(filter.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              shift === filter.value
                ? "bg-brand text-brand-foreground font-semibold"
                : "border border-border/70 text-muted-foreground hover:bg-muted/50",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTechnician(null)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            activeTechnician === null
              ? "bg-foreground text-background font-semibold"
              : "border border-border/70 text-muted-foreground hover:bg-muted/50",
          )}
        >
          Todos os técnicos
        </button>
        {technicians.map((tech) => {
          const active = activeTechnician === tech.id;
          const count = countFor(tech.id);
          return (
            <button
              key={tech.id}
              type="button"
              // Clicar no tecnico ja isolado devolve a visao geral.
              onClick={() => setActiveTechnician(active ? null : tech.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-transparent text-white"
                  : "border-border/70 text-muted-foreground hover:bg-muted/50",
                count === 0 && !active && "opacity-50",
              )}
              style={active ? { backgroundColor: colorByTechnician[tech.id] } : undefined}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: active ? "#fff" : colorByTechnician[tech.id] }}
              />
              {tech.name}
              <span className={active ? "text-white/80" : "text-muted-foreground/70"}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative h-[calc(100vh-20rem)] min-h-[420px] overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
        {visibleStops.length === 0 ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <p className="font-medium">Nenhuma parada pra mostrar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sem OS agendada nesse filtro, ou os endereços ainda não foram localizados no mapa.
              </p>
            </div>
          </div>
        ) : hasWebGL === null ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Carregando mapa...
          </div>
        ) : hasWebGL === false ? (
          // Sem WebGL2 o mapa nem chega a ser montado: mostrar a lista e melhor
          // que deixar o MapLibre quebrar a tela inteira.
          <StopsFallback
            stops={visibleStops}
            technicians={technicians}
            colorByTechnician={colorByTechnician}
            reason="webgl"
          />
        ) : (
          <MapBoundary
            fallback={
              <StopsFallback
                stops={visibleStops}
                technicians={technicians}
                colorByTechnician={colorByTechnician}
                reason="error"
              />
            }
          >
            <MapCanvas
              stops={visibleStops}
              technicians={visibleTechnicians}
              base={base}
              colorByTechnician={colorByTechnician}
              positions={visiblePositions}
            />
          </MapBoundary>
        )}
      </div>
    </div>
  );
}
