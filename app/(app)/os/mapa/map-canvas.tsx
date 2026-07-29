"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Home } from "lucide-react";
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
import { technicianColor, type MapBase, type MapStop, type MapTechnician } from "./types";

/**
 * Basemap sem chave e sem custo. O OpenFreeMap serve tiles de OpenStreetMap
 * liberados pra uso comercial, sem cadastro e sem cota - por isso ele, e nao
 * o Google, sustenta esta tela. Trocar a URL aqui troca o mapa inteiro.
 */
const BASEMAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
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

export function MapCanvas({
  stops,
  technicians,
  base,
  colorByTechnician,
}: {
  stops: MapStop[];
  technicians: MapTechnician[];
  base: MapBase | null;
  colorByTechnician: Record<string, string>;
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
            <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-foreground text-background shadow-md">
              <Home className="h-3.5 w-3.5" />
            </div>
          </MarkerContent>
          <MarkerTooltip>Base · {base.address}</MarkerTooltip>
        </MapMarker>
      )}

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
            <MarkerTooltip>
              {stop.leadName} · {stop.code}
            </MarkerTooltip>
            <MarkerPopup closeButton>
              <div className="space-y-1.5">
                <div>
                  <p className="text-sm font-semibold">{stop.leadName}</p>
                  <p className="text-muted-foreground text-xs">
                    {stop.code}
                    {stop.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[stop.shift]}` : ""}
                    {stop.routePosition ? ` · ${stop.routePosition}ª parada` : ""}
                  </p>
                </div>
                <p className="text-xs">{stop.address}</p>
                <p className="text-muted-foreground text-xs">
                  {names || "Sem técnico alocado"}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs font-medium">
                    {SERVICE_ORDER_STATUS_LABEL[stop.status]}
                  </span>
                  <span className="text-xs font-semibold">
                    {formatCurrencyBRL(stop.totalCents)}
                  </span>
                </div>
                <Link
                  href={`/os/${stop.id}`}
                  className="text-brand block pt-1 text-xs font-medium hover:underline"
                >
                  Abrir OS →
                </Link>
              </div>
            </MarkerPopup>
          </MapMarker>
        );
      })}
    </MapView>
  );
}

export default MapCanvas;
