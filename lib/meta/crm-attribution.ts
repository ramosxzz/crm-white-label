import type { SupabaseClient } from "@supabase/supabase-js";
import type { MetaDatePreset } from "./ads-insights";

export type MetaAdCrmSales = { sales: number; revenueCents: number; leads: number };

type LeadAttributionRow = {
  custom_fields: Record<string, unknown> | null;
  created_at: string | null;
  won_at: string | null;
  value_cents: number | null;
};

const META_AD_ID_KEYS = [
  "meta_ad_id",
  "meta_source_id",
  "ad_id",
  "source_id",
  "ctwa_ad_id",
  "whatsapp_ad_id",
];

function datePresetRange(preset: MetaDatePreset): { startIso: string; endIso: string } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    return next;
  };
  const endOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(23, 59, 59, 999);
    return next;
  };

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { startIso: startOfDay(yesterday).toISOString(), endIso: endOfDay(yesterday).toISOString() };
  }
  if (preset === "last_7d") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { startIso: start.toISOString(), endIso: endOfDay(now).toISOString() };
  }
  if (preset === "last_30d") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 29);
    return { startIso: start.toISOString(), endIso: endOfDay(now).toISOString() };
  }
  return { startIso: startOfDay(now).toISOString(), endIso: endOfDay(now).toISOString() };
}

function isWithinRange(value: string | null | undefined, startIso: string, endIso: string) {
  return Boolean(value && value >= startIso && value <= endIso);
}

function pickMetaAdId(fields: Record<string, unknown> | null | undefined) {
  if (!fields) return null;
  for (const key of META_AD_ID_KEYS) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * Vendas (leads ganhos) do CRM atribuidas ao anuncio de origem, via
 * custom_fields gravado no lead a partir do referral do Click-to-WhatsApp.
 * Diferente de MetaAdsRow.purchases (pixel da Meta),
 * que normalmente fica zerado em negocios que fecham por WhatsApp/ligacao
 * em vez de checkout.
 */
export async function getMetaAdsCrmSales(
  supabase: SupabaseClient,
  tenantId: string,
  datePreset: MetaDatePreset,
): Promise<Map<string, MetaAdCrmSales>> {
  const { startIso, endIso } = datePresetRange(datePreset);
  const { data } = await supabase
    .from("leads")
    .select("custom_fields, created_at, won_at, value_cents")
    .eq("tenant_id", tenantId)
    .not("custom_fields", "is", null);

  const byAd = new Map<string, MetaAdCrmSales>();
  for (const row of (data ?? []) as LeadAttributionRow[]) {
    const adId = pickMetaAdId(row.custom_fields);
    if (!adId) continue;
    const entry = byAd.get(adId) ?? { sales: 0, revenueCents: 0, leads: 0 };
    if (isWithinRange(row.created_at, startIso, endIso)) {
      entry.leads += 1;
    }
    if (isWithinRange(row.won_at, startIso, endIso)) {
      entry.sales += 1;
      entry.revenueCents += row.value_cents ?? 0;
    }
    if (entry.leads > 0 || entry.sales > 0 || entry.revenueCents > 0) {
      byAd.set(adId, entry);
    }
  }
  return byAd;
}
