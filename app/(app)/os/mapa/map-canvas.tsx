"use client";

import { useEffect, useMemo } from "react";
import { Home, MapPin, Truck, Wrench } from "lucide-react";
import {
  // Importado com alias de proposito: o componente se chama `Map` e sombreia o
  // `Map` nativo do JavaScript, quebrando qualquer `new Map()` deste arquivo.
  Map as MapView,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  useMap,
} from "@/components/ui/mapcn-map-marker";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
} from "@/lib/field-service/status";
import { isPositionFresh } from "@/lib/field-service/tracking-window";
import {
  technicianColor,
  type MapBase,
  type MapStop,
  type MapTechnician,
  type TechnicianPosition,
} from "./types";

/**
 * Basemap sem chave e sem custo. O OpenFreeMap serve tiles de OpenStreetMap
 * liberados pra uso comercial, sem cadastro e sem cota - por isso ele, e nao
 * o Google, sustenta esta tela. Trocar a URL aqui troca o mapa inteiro.
 *
 * O tema escuro usa `fiord`, e nao o `dark`. O `dark` desenha preto sobre
 * preto - fundo rgb(12,12,12), agua rgb(27,27,29) e via na mesma cor do fundo -
 * entao o mapa aparecia como um retangulo preto e parecia quebrado, com os
 * pinos boiando no vazio. O `fiord` tem fundo #45516E, vias em tons distintos
 * e rotulos claros. Ao trocar de estilo, conferir contraste antes: aqui o
 * mapa e ferramenta de trabalho, legibilidade vale mais que combinar com o
 * tema do CRM.
 */
const BASEMAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};

/** Enquadra o mapa nas paradas visiveis sempre que o filtro muda. */
function FitToStops({ stops, base }: { stops: MapStop[]; base: MapBase | null }) {
  const { map, isLoaded } = useMap();

  // Chave estavel: refazer o enquadramento so quando o conjunto muda de fato,
  // senao qualquer re-render puxaria o mapa de volta e o ADM nao conseguiria
  // arrastar pra lugar nenhum.
  const key = stops.map((stop) => stop.id).join(",");

  useEffect(() => {
    if (!isLoaded || !map) return;

    const points: Array<[number, number]> = stops.map((stop) => [stop.lng, stop.lat]);
    if (base) points.push([base.lng, base.lat]);
    if (points.length === 0) return;

    if (points.length === 1) {
      map.easeTo({ center: points[0], zoom: 14, duration: 500 });
      return;
    }

    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 72, maxZoom: 15, duration: 600 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map, key]);

  return null;
}

function StopPin({ color, label }: { color: string; label: string }) {
  return (
    <div
      className="grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-md"
      style={{ backgroundColor: color }}
    >
      {label}
    </div>
  );
}

/** Marcador do tecnico: pulsa e usa a cor dele, pra nao virar mais uma parada. */
function TechnicianPin({ color, fresh }: { color: string; fresh: boolean }) {
  return (
    <div className="relative grid place-items-center">
      {fresh && (
        <span
          className="absolute h-8 w-8 animate-ping rounded-full opacity-40 motion-reduce:animate-none"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="relative grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-md"
        style={{ backgroundColor: fresh ? color : "#64748b" }}
      >
        <Truck className="h-3 w-3 text-white" />
      </span>
    </div>
  );
}

function minutesAgo(recordedAt: string) {
  const diff = Date.now() - new Date(recordedAt).getTime();
  const min = Math.max(0, Math.round(diff / 60000));
  if (min < 1) return "agora";
  if (min === 1) return "há 1 minuto";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.floor(min / 60);
  return h === 1 ? "há 1 hora" : `há ${h} horas`;
}

export function MapCanvas({
  stops,
  technicians,
  base,
  colorByTechnician,
  positions = [],
  onOpenOrder,
}: {
  stops: MapStop[];
  technicians: MapTechnician[];
  base: MapBase | null;
  colorByTechnician: Record<string, string>;
  positions?: TechnicianPosition[];
  /** Abre o detalhe por cima do mapa, sem tirar o ADM da tela. */
  onOpenOrder?: (orderId: string) => void;
}) {
  const technicianName = useMemo(
    () => new Map(technicians.map((tech) => [tech.id, tech.name])),
    [technicians],
  );

  /**
   * Uma linha por tecnico/turno, ligando as paradas na ordem da rota. E um
   * traco reto entre pontos, nao o caminho pelas ruas: desenhar o trajeto real
   * exigiria a Routes API paga, e aqui o que importa e a sequencia.
   */
  const routes = useMemo(() => {
    const groups = new Map<string, { color: string; coordinates: [number, number][] }>();

    for (const tech of technicians) {
      for (const shift of ["manha", "tarde"] as const) {
        const ordered = stops
          .filter((stop) => stop.shift === shift && stop.technicianIds.includes(tech.id))
          .sort((a, b) => (a.routePosition ?? 999) - (b.routePosition ?? 999));
        if (ordered.length < 1) continue;

        const coordinates: [number, number][] = ordered.map((stop) => [stop.lng, stop.lat]);
        // Sai da base e volta pra base, igual a otimizacao de rota faz.
        if (base) {
          coordinates.unshift([base.lng, base.lat]);
          coordinates.push([base.lng, base.lat]);
        }
        if (coordinates.length < 2) continue;

        groups.set(`${tech.id}-${shift}`, {
          color: colorByTechnician[tech.id] ?? technicianColor(0),
          coordinates,
        });
      }
    }

    return [...groups.entries()].map(([id, value]) => ({ id, ...value }));
  }, [stops, technicians, base, colorByTechnician]);

  const center: [number, number] = base
    ? [base.lng, base.lat]
    : stops.length > 0
      ? [stops[0].lng, stops[0].lat]
      : // Sapucaia do Sul: so serve de fallback ate o mapa se enquadrar.
        [-51.145, -29.83];

  return (
    <MapView center={center} zoom={11} styles={BASEMAP_STYLES} className="h-full w-full">
      <MapControls position="top-right" showZoom showCompass showFullscreen />
      <FitToStops stops={stops} base={base} />

      {routes.map((route) => (
        <MapRoute
          key={route.id}
          id={route.id}
          coordinates={route.coordinates}
          color={route.color}
          width={3}
          opacity={0.55}
          dashArray={[2, 1.5]}
          interactive={false}
        />
      ))}

      {base && (
        <MapMarker longitude={base.lng} latitude={base.lat}>
          <MarkerContent>
            <div className="flex flex-col items-center">
              <div className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-foreground text-background shadow-md">
                <Home className="h-4 w-4" />
              </div>
              {/* Rotulo fixo: o ADM precisa achar a sede de relance, sem
                  descobrir que tem que passar o mouse em cima. */}
              <span className="bg-foreground text-background mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm">
                Base
              </span>
            </div>
          </MarkerContent>
          <MarkerTooltip className="bg-popover text-popover-foreground border border-border/60 px-2.5 py-1.5 font-medium shadow-md">
            Sede · {base.address}
          </MarkerTooltip>
        </MapMarker>
      )}

      {positions.map((pos) => {
        const tech = technicians.find((t) => t.id === pos.technicianId);
        if (!tech) return null;
        const fresh = isPositionFresh(pos.recordedAt);
        const color = colorByTechnician[pos.technicianId] ?? "#64748b";
        return (
          <MapMarker
            key={`tech-${pos.technicianId}`}
            longitude={pos.lng}
            latitude={pos.lat}
          >
            <MarkerContent>
              <TechnicianPin color={color} fresh={fresh} />
            </MarkerContent>
            <MarkerTooltip className="bg-popover text-popover-foreground border border-border/60 px-2.5 py-1.5 font-medium shadow-md">
              {tech.name} · {fresh ? minutesAgo(pos.recordedAt) : "posição desatualizada"}
            </MarkerTooltip>
          </MapMarker>
        );
      })}

      {stops.map((stop) => {
        const primary = stop.technicianIds[0];
        const color = (primary && colorByTechnician[primary]) || "#64748b";
        const names = stop.technicianIds
          .map((id) => technicianName.get(id))
          .filter(Boolean)
          .join(" + ");

        return (
          <MapMarker key={stop.id} longitude={stop.lng} latitude={stop.lat}>
            <MarkerContent>
              <StopPin color={color} label={stop.routePosition ? String(stop.routePosition) : "•"} />
            </MarkerContent>
            {/* Mesmas cores do balao de clique: a setinha do MapLibre e uma
                so, entao os dois precisam usar a cor de popover. */}
            <MarkerTooltip className="bg-popover text-popover-foreground border border-border/60 px-2.5 py-1.5 font-medium shadow-md">
              {stop.leadName} · {stop.code}
            </MarkerTooltip>
            <MarkerPopup closeButton className="w-64 max-w-none overflow-hidden p-0">
              <header className="border-b border-border/60 px-3 py-2.5">
                <p className="pr-5 text-sm font-semibold leading-tight">{stop.leadName}</p>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  {stop.code}
                  {stop.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[stop.shift]}` : ""}
                  {stop.routePosition ? ` · ${stop.routePosition}ª parada` : ""}
                </p>
              </header>

              <div className="space-y-1.5 px-3 py-2.5">
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-snug">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  {stop.address}
                </p>
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs leading-snug">
                  <Wrench className="mt-0.5 h-3 w-3 shrink-0" />
                  {names || "Sem técnico alocado"}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {SERVICE_ORDER_STATUS_LABEL[stop.status]}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrencyBRL(stop.totalCents)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpenOrder?.(stop.id)}
                className="text-brand hover:bg-brand/10 block w-full border-t border-border/60 px-3 py-2 text-center text-xs font-semibold transition-colors"
              >
                Abrir OS
              </button>
            </MarkerPopup>
          </MapMarker>
        );
      })}
    </MapView>
  );
}

export default MapCanvas;
