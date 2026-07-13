export type MetaAdsStatus = "ready" | "not_configured" | "error";

export type MetaAdsRow = {
  id: string;
  name: string;
  campaignName: string;
  adsetName: string;
  spendCents: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpcCents: number;
  cpmCents: number;
  ctr: number;
  leads: number;
  purchases: number;
  revenueCents: number;
  roas: number;
};

export type MetaAdsDashboardData = {
  status: MetaAdsStatus;
  error?: string;
  errorCode?: number;
  errorType?: string;
  adAccountId?: string | null;
  datePreset: "today";
  updatedAt: string;
  totals: {
    spendCents: number;
    revenueCents: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
    purchases: number;
    roas: number;
    cacCents: number;
    cplCents: number;
  };
  rows: MetaAdsRow[];
};

type MetaAction = { action_type?: string; value?: string };

type MetaInsightRow = {
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  purchase_roas?: MetaAction[];
};

const GRAPH_VERSION = "v25.0";

const LEAD_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "omni_lead",
]);

const PURCHASE_ACTIONS = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_conversion.purchase",
]);

export async function getMetaAdsDashboard(input: {
  adAccountId?: string | null;
  accessToken?: string | null;
}): Promise<MetaAdsDashboardData> {
  const adAccountId = normalizeAdAccountId(input.adAccountId);
  const accessToken = input.accessToken?.trim();

  if (!adAccountId || !accessToken) {
    return emptyMetaDashboard("not_configured", adAccountId);
  }

  const fields = [
    "ad_id",
    "ad_name",
    "adset_name",
    "campaign_name",
    "spend",
    "impressions",
    "reach",
    "clicks",
    "cpc",
    "cpm",
    "ctr",
    "actions",
    "action_values",
    "purchase_roas",
  ].join(",");

  const params = new URLSearchParams({
    fields,
    level: "ad",
    date_preset: "today",
    limit: "50",
    access_token: accessToken,
  });

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(adAccountId)}/insights?${params.toString()}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as {
      data?: MetaInsightRow[];
      error?: { message?: string; code?: number; type?: string };
    } | null;

    if (!response.ok) {
      return {
        ...emptyMetaDashboard("error", adAccountId),
        error: translateMetaAdsError(payload?.error?.message),
        errorCode: payload?.error?.code,
        errorType: payload?.error?.type,
      };
    }

    const rows = (payload?.data ?? []).map(normalizeInsightRow).sort((a, b) => b.spendCents - a.spendCents);
    const totals = rows.reduce(
      (acc, row) => {
        acc.spendCents += row.spendCents;
        acc.revenueCents += row.revenueCents;
        acc.impressions += row.impressions;
        acc.reach += row.reach;
        acc.clicks += row.clicks;
        acc.leads += row.leads;
        acc.purchases += row.purchases;
        return acc;
      },
      {
        spendCents: 0,
        revenueCents: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        leads: 0,
        purchases: 0,
        roas: 0,
        cacCents: 0,
        cplCents: 0,
      },
    );

    totals.roas = totals.spendCents > 0 ? round2(totals.revenueCents / totals.spendCents) : 0;
    totals.cplCents = totals.leads > 0 ? Math.round(totals.spendCents / totals.leads) : 0;
    totals.cacCents = totals.purchases > 0 ? Math.round(totals.spendCents / totals.purchases) : totals.cplCents;

    return {
      status: "ready",
      adAccountId,
      datePreset: "today",
      updatedAt: new Date().toISOString(),
      totals,
      rows,
    };
  } catch (error) {
    return {
      ...emptyMetaDashboard("error", adAccountId),
      error: error instanceof Error ? error.message : "Erro inesperado ao consultar o Meta Ads.",
    };
  }
}

function emptyMetaDashboard(status: MetaAdsStatus, adAccountId?: string | null): MetaAdsDashboardData {
  return {
    status,
    adAccountId,
    datePreset: "today",
    updatedAt: new Date().toISOString(),
    totals: {
      spendCents: 0,
      revenueCents: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      leads: 0,
      purchases: 0,
      roas: 0,
      cacCents: 0,
      cplCents: 0,
    },
    rows: [],
  };
}

function translateMetaAdsError(message?: string) {
  if (!message) return "Nao foi possivel carregar os dados do Meta Ads.";

  const lower = message.toLowerCase();
  if (lower.includes("ads_management") || lower.includes("ads_read")) {
    return "O token salvo nao tem permissao para ler a conta de anuncios. Gere um token da Marketing API com ads_read ou ads_management usando um usuario que tenha acesso a essa conta de anuncios, salve na integracao Meta e tente novamente.";
  }

  if (lower.includes("invalid oauth") || lower.includes("access token")) {
    return "O token da Meta esta invalido ou expirou. Gere um novo token de longa duracao e salve novamente na integracao Meta.";
  }

  return message;
}

function normalizeInsightRow(row: MetaInsightRow): MetaAdsRow {
  const spendCents = moneyToCents(row.spend);
  const revenueCents = extractActionMoney(row.action_values, PURCHASE_ACTIONS);
  const metaRoas = Number(row.purchase_roas?.[0]?.value ?? 0);
  return {
    id: row.ad_id ?? row.ad_name ?? crypto.randomUUID(),
    name: row.ad_name || "Anuncio sem nome",
    campaignName: row.campaign_name || "Campanha sem nome",
    adsetName: row.adset_name || "Conjunto sem nome",
    spendCents,
    impressions: toInt(row.impressions),
    reach: toInt(row.reach),
    clicks: toInt(row.clicks),
    cpcCents: moneyToCents(row.cpc),
    cpmCents: moneyToCents(row.cpm),
    ctr: round2(Number(row.ctr ?? 0)),
    leads: extractActionCount(row.actions, LEAD_ACTIONS),
    purchases: extractActionCount(row.actions, PURCHASE_ACTIONS),
    revenueCents,
    roas: metaRoas > 0 ? round2(metaRoas) : spendCents > 0 ? round2(revenueCents / spendCents) : 0,
  };
}

function normalizeAdAccountId(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  return raw.startsWith("act_") ? raw : `act_${raw.replace(/\D/g, "")}`;
}

function extractActionCount(actions: MetaAction[] | undefined, actionTypes: Set<string>) {
  return Math.round(
    (actions ?? []).reduce((sum, action) => {
      return action.action_type && actionTypes.has(action.action_type) ? sum + Number(action.value ?? 0) : sum;
    }, 0),
  );
}

function extractActionMoney(actions: MetaAction[] | undefined, actionTypes: Set<string>) {
  return (actions ?? []).reduce((sum, action) => {
    return action.action_type && actionTypes.has(action.action_type) ? sum + moneyToCents(action.value) : sum;
  }, 0);
}

function moneyToCents(value?: string) {
  return Math.round(Number(value ?? 0) * 100);
}

function toInt(value?: string) {
  return Math.round(Number(value ?? 0));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
