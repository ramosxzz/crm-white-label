/**
 * Roteirizacao dos tecnicos via Google Maps.
 *
 * A chave e SERVER-ONLY de proposito: com prefixo NEXT_PUBLIC_ ela iria
 * embutida no bundle JavaScript e ficaria publica, gerando custo de billing
 * pra qualquer um que a copiasse. Toda chamada ao Google sai daqui.
 *
 * Custo: a API de rotas e paga por requisicao. Por isso:
 *   - o geocoding de cada OS e feito uma unica vez e gravado em lat/lng;
 *   - a otimizacao do turno e disparada sob demanda (botao), nao a cada
 *     carregamento da tela.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export type LatLng = { lat: number; lng: number };

export type RoutableStop = {
  id: string;
  lat: number | null;
  lng: number | null;
};

export class RoutingNotConfiguredError extends Error {
  constructor() {
    super("Roteirizacao indisponivel: GOOGLE_MAPS_API_KEY nao configurada no servidor.");
    this.name = "RoutingNotConfiguredError";
  }
}

function apiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new RoutingNotConfiguredError();
  return key;
}

export function isRoutingEnabled() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

/** Monta o endereco de uma linha da OS no formato que o Google entende. */
export function buildAddressQuery(order: {
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_cep?: string | null;
}): string | null {
  const street = [order.address_street, order.address_number].filter(Boolean).join(", ");
  const parts = [street, order.address_district, order.address_city, order.address_state, order.address_cep]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0);

  // Sem rua nem cidade o geocoding devolve qualquer coisa - melhor nao chamar.
  if (!order.address_street || parts.length < 2) return null;
  return `${parts.join(", ")}, Brasil`;
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&region=br&key=${apiKey()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Geocoding falhou (HTTP ${response.status})`);
  }

  const data = (await response.json()) as {
    status: string;
    results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
    error_message?: string;
  };

  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    throw new Error(`Geocoding falhou: ${data.error_message ?? data.status}`);
  }

  const location = data.results?.[0]?.geometry?.location;
  return location ? { lat: location.lat, lng: location.lng } : null;
}

type RouteResult = {
  /** Ordem otimizada das paradas intermediarias, referenciando o array de entrada. */
  order: number[];
  distanceMeters: number;
  durationSeconds: number;
};

function waypoint(point: LatLng) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lng } } };
}

function parseDurationSeconds(duration: string | undefined) {
  // A Routes API devolve duracao como string tipo "1234s".
  if (!duration) return 0;
  const parsed = Number.parseInt(duration.replace(/s$/, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Ordena as paradas de um turno saindo de `origin` e voltando pra `origin`.
 * Retorna os indices na ordem otimizada (relativos ao array `stops`).
 */
export async function optimizeRoute(origin: LatLng, stops: LatLng[]): Promise<RouteResult> {
  if (stops.length === 0) {
    return { order: [], distanceMeters: 0, durationSeconds: 0 };
  }

  // Com uma parada so nao ha o que otimizar - evita uma chamada paga.
  if (stops.length === 1) {
    const single = await computeRouteDistance(origin, stops);
    return { order: [0], ...single };
  }

  const response = await fetch(ROUTES_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify({
      origin: waypoint(origin),
      destination: waypoint(origin),
      intermediates: stops.map(waypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: true,
      languageCode: "pt-BR",
      units: "METRIC",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Otimizacao de rota falhou (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      optimizedIntermediateWaypointIndex?: number[];
    }>;
  };

  const route = data.routes?.[0];
  if (!route) throw new Error("Google nao retornou rota para esse turno.");

  return {
    order: route.optimizedIntermediateWaypointIndex ?? stops.map((_, index) => index),
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: parseDurationSeconds(route.duration),
  };
}

/** Distancia/duracao de uma rota ja ordenada (sem pedir otimizacao). */
export async function computeRouteDistance(
  origin: LatLng,
  stops: LatLng[],
): Promise<{ distanceMeters: number; durationSeconds: number }> {
  if (stops.length === 0) return { distanceMeters: 0, durationSeconds: 0 };

  const response = await fetch(ROUTES_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: waypoint(origin),
      destination: waypoint(origin),
      intermediates: stops.map(waypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "pt-BR",
      units: "METRIC",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Calculo de rota falhou (HTTP ${response.status}): ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    routes?: Array<{ distanceMeters?: number; duration?: string }>;
  };
  const route = data.routes?.[0];
  return {
    distanceMeters: route?.distanceMeters ?? 0,
    durationSeconds: parseDurationSeconds(route?.duration),
  };
}

export type TechnicianRouteLoad = {
  technicianId: string;
  technicianName: string;
  stops: LatLng[];
  currentDistanceMeters: number;
};

export type TechnicianSuggestion = {
  technicianId: string;
  technicianName: string;
  extraDistanceMeters: number;
  stopCount: number;
};

/**
 * Sugere qual tecnico do turno absorve melhor uma parada nova, medindo o
 * acrescimo de distancia que ela causa na rota de cada um.
 *
 * Custo: 1 chamada paga por tecnico com paradas. A distancia atual de cada um
 * ja vem calculada de `optimizeRoute` (passada em currentDistanceMeters), pra
 * nao dobrar o numero de chamadas.
 */
export async function suggestBestTechnician(
  origin: LatLng,
  loads: TechnicianRouteLoad[],
  newStop: LatLng,
): Promise<TechnicianSuggestion[]> {
  const suggestions = await Promise.all(
    loads.map(async (load) => {
      const withNew = await optimizeRoute(origin, [...load.stops, newStop]);
      return {
        technicianId: load.technicianId,
        technicianName: load.technicianName,
        extraDistanceMeters: Math.max(0, withNew.distanceMeters - load.currentDistanceMeters),
        stopCount: load.stops.length,
      };
    }),
  );

  // Menor desvio primeiro; empate desempata por quem tem menos paradas, pra
  // nao concentrar o turno inteiro num tecnico so.
  return suggestions.sort(
    (a, b) => a.extraDistanceMeters - b.extraDistanceMeters || a.stopCount - b.stopCount,
  );
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

/** Link de navegacao pro celular do tecnico (Waze cai pro Maps se nao instalado). */
export function navigationLink(point: { lat: number | null; lng: number | null }, address: string | null) {
  if (point.lat != null && point.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  }
  return null;
}
