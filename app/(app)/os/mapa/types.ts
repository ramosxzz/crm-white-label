import type { ServiceOrderStatus } from "@/lib/supabase/database.types";

/** Uma parada plotada no mapa do dia. */
export type MapStop = {
  id: string;
  code: string;
  lat: number;
  lng: number;
  leadName: string;
  address: string;
  status: ServiceOrderStatus;
  shift: "manha" | "tarde" | null;
  routePosition: number | null;
  totalCents: number;
  /** Uma OS pode ter dupla de tecnicos; o primeiro define a cor do pino. */
  technicianIds: string[];
};

export type MapTechnician = { id: string; name: string };

export type MapBase = { lat: number; lng: number; address: string };

/**
 * Cores dos tecnicos. Escolhidas pra continuar distinguiveis sobre o basemap
 * claro e o escuro, e pra nao colidir com o vermelho de "cancelada".
 */
export const TECHNICIAN_COLORS = [
  "#2563eb",
  "#e11d48",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export function technicianColor(index: number) {
  return TECHNICIAN_COLORS[index % TECHNICIAN_COLORS.length];
}
