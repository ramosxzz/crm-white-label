import { createClient } from "@/lib/supabase/server";
import { geocodeAddress, isRoutingEnabled, type LatLng } from "./routing";

type BaseTenant = {
  field_service_base_address: string | null;
  field_service_base_lat: number | null;
  field_service_base_lng: number | null;
};

/**
 * Coordenada da sede: ponto de partida e retorno do roteiro, e o pino de
 * casinha no mapa do dia.
 *
 * O endereco e cadastrado em texto nas Configuracoes; a coordenada e
 * descoberta na primeira vez que alguem precisa dela e gravada no tenant.
 * Ou seja: **uma unica chamada paga ao Google por empresa, na vida toda** -
 * depois disso sai direto do banco.
 */
export async function resolveBaseLocation(
  tenant: BaseTenant,
  tenantId: string,
): Promise<LatLng | null> {
  if (tenant.field_service_base_lat != null && tenant.field_service_base_lng != null) {
    return { lat: tenant.field_service_base_lat, lng: tenant.field_service_base_lng };
  }
  if (!tenant.field_service_base_address) return null;
  if (!isRoutingEnabled()) return null;

  const point = await geocodeAddress(tenant.field_service_base_address);
  if (!point) return null;

  const supabase = await createClient();
  await supabase
    .from("tenants")
    .update({ field_service_base_lat: point.lat, field_service_base_lng: point.lng })
    .eq("id", tenantId);

  return point;
}
