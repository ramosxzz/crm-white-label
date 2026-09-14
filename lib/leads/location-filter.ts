export const VASOS_FORTUNA_TENANT_ID = "fd0f666f-e303-4694-aa51-1190740c3d12";

const MAX_LOCATION_FILTER_LENGTH = 120;

export function canFilterLeadsByLocation(tenantId: string) {
  return tenantId === VASOS_FORTUNA_TENANT_ID;
}

export function normalizeLeadLocationFilter(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ").slice(0, MAX_LOCATION_FILTER_LENGTH) ?? "";
  return normalized || null;
}
