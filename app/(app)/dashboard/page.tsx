import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { PageHeader } from "@/components/app/page-header";
import { LeadsOpsDashboard } from "@/components/dashboard/leads-ops-dashboard";
import { SellerDashboard } from "@/components/dashboard/seller-dashboard";
import {
  formatBRTDateLong,
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
} from "@/lib/date/brt";
import { DashboardDateFilter } from "@/components/dashboard/dashboard-date-filter";
import {
  aggregateSources,
  aggregateStarsForBounds,
  buildLeadsByHour,
  buildWeekTrend,
  type LeadsDashboardData,
} from "@/lib/leads/dashboard-metrics";
import { getMetaAdsDashboard, type MetaDatePreset } from "@/lib/meta/ads-insights";
import { getMetaAdsCrmSales } from "@/lib/meta/crm-attribution";
import { canSeeFullDashboard, canManageCompanySettings } from "@/lib/auth/roles";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { LeadForwardingControl } from "@/components/dashboard/lead-forwarding-control";
import { getSellerDashboardMetrics } from "@/lib/dashboard/seller-metrics";
import { resolvePeriodFilter, type PeriodFilter } from "@/lib/date/period-filter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    ads?: string;
    funil?: string;
    funilDia?: string;
    estrelas?: string;
    estrelasDia?: string;
  }>;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const todayBounds = getBRTDayBounds();
  const sp = await searchParams;

  // Periodo proprio de cada cartao. Default "todos" para manter o
  // comportamento anterior de quem ja usa a tela: sem escolher nada, os dois
  // cartoes seguem mostrando o acumulado.
  const funnelPeriod = resolvePeriodFilter(sp.funil, sp.funilDia);
  const starsPeriod = resolvePeriodFilter(sp.estrelas, sp.estrelasDia);
  // Dia selecionado no filtro (default: hoje). Nao permite futuro.
  const parsed = sp.date ? getBRTDayBoundsFromDateString(sp.date) : null;
  const today = parsed && parsed.dateStr <= todayBounds.dateStr ? parsed : todayBounds;
  const selDate = new Date(today.startIso);
  const yesterday = getBRTDayBounds(new Date(selDate.getTime() - 24 * 60 * 60 * 1000));
  const dayLabel = formatBRTDateLong(selDate);

  if (!canSeeFullDashboard(ctx.role)) {
    const sellerMetrics = await getSellerDashboardMetrics(createServiceClient(), {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      startIso: today.startIso,
      endIso: today.endIso,
    });

    return (
      <div>
        <PageHeader
          eyebrow={sellerMetrics.sharedNumber ? "Atendimento da equipe" : "Meu desempenho"}
          title="Central de operações"
          description={
            sellerMetrics.sharedNumber
              ? "Movimento do número compartilhado no dia."
              : "Suas métricas de atendimento no dia."
          }
        />
        <SellerDashboard
          data={{
            dateLabel: dayLabel,
            ...sellerMetrics,
          }}
        />
      </div>
    );
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartStr = weekStart.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const [
    { data: leadsToday },
    { data: leadsYesterday },
    { data: leadsWeek },
    { data: stageCounts },
    { data: stages },
    { count: messagesToday },
    { data: convosToday },
    { count: sharedQueueLeads },
    { count: appointmentsToday },
    { count: overdueTasks },
    { data: wonTodayRows },
    productsResult,
    activeReservationsResult,
    { data: tenantMeta },
    { data: allLeadsStars },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, source, created_at, stage_id, value_cents")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", today.startIso)
      .lte("created_at", today.endIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", yesterday.startIso)
      .lte("created_at", yesterday.endIso),
    supabase
      .from("leads")
      .select("created_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", `${weekStartStr}T00:00:00-03:00`),
    // Sem recorte de data usa o RPC enxuto de sempre. Com recorte cai no
    // funnel_metrics, que aceita intervalo e ja filtra por leads.created_at -
    // e mais caro (calcula tempo medio por etapa), entao so paga quando o
    // usuario realmente filtra.
    funnelPeriod.bounds
      ? supabase.rpc("funnel_metrics", {
          p_tenant_id: ctx.tenantId,
          p_pipeline_id: undefined,
          p_from: funnelPeriod.bounds.startIso,
          p_to: funnelPeriod.bounds.endIso,
        })
      : supabase.rpc("dashboard_stage_counts", { p_tenant_id: ctx.tenantId }),
    supabase
      .from("pipeline_stages")
      .select("id, name, color, position, is_won, is_lost")
      .eq("tenant_id", ctx.tenantId)
      .order("position"),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("direction", "outbound")
      .gte("created_at", today.startIso)
      .lte("created_at", today.endIso),
    supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .gte("last_message_at", today.startIso)
      .lte("last_message_at", today.endIso),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).is("assigned_to", null),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).gte("starts_at", today.startIso).lte("starts_at", today.endIso),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("status", "open").lt("due_at", new Date().toISOString()),
    supabase
      .from("leads")
      .select("id, value_cents")
      .eq("tenant_id", ctx.tenantId)
      .gte("won_at", today.startIso)
      .lte("won_at", today.endIso),
    ctx.tenant.stock_enabled
      ? supabase.from("products").select("id, stock_quantity, min_stock").eq("tenant_id", ctx.tenantId).eq("is_active", true)
      : Promise.resolve({ data: [] }),
    ctx.tenant.stock_enabled
      ? supabase.from("stock_reservations").select("product_id, quantity").eq("tenant_id", ctx.tenantId).eq("status", "active")
      : Promise.resolve({ data: [] }),
    supabase
      .from("tenants")
      .select("meta_ad_account_id, meta_ads_access_token, meta_capi_token, lead_forward_user_id")
      .eq("id", ctx.tenantId)
      .single(),
    supabase.from("leads").select("quality_stars, created_at").eq("tenant_id", ctx.tenantId),
  ]);
  const products = productsResult.data ?? [];
  const activeReservations = activeReservationsResult.data ?? [];

  const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));
  const stageCountMap = new Map(
    ((stageCounts ?? []) as { stage_id: string | null; lead_count: number | string }[]).map((row) => [
      row.stage_id,
      Number(row.lead_count ?? 0),
    ]),
  );

  const pipelineByStage = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? "#94a3b8",
    count: stageCountMap.get(s.id) ?? 0,
    isWon: s.is_won,
    isLost: s.is_lost,
  }));

  const { distribution: starsDistribution, average: starsAverage } = aggregateStarsForBounds(
    allLeadsStars ?? [],
    starsPeriod.bounds,
  );
  const starsByPeriod: LeadsDashboardData["starsByPeriod"] = {};
  for (const period of ["today", "7d", "30d", "this_month", "all"] as PeriodFilter[]) {
    const bounds = resolvePeriodFilter(period).bounds;
    const aggregated = aggregateStarsForBounds(allLeadsStars ?? [], bounds);
    starsByPeriod[period] = {
      distribution: aggregated.distribution,
      average: aggregated.average,
    };
  }
  const wonToday = wonTodayRows?.length ?? 0;
  const wonValueTodayCents = (wonTodayRows ?? []).reduce((a, l) => a + (l.value_cents ?? 0), 0);
  const pipelineValueTodayCents = (leadsToday ?? []).reduce((a, l) => a + (l.value_cents ?? 0), 0);
  const reservedByProduct = new Map<string, number>();
  for (const reservation of activeReservations) {
    reservedByProduct.set(reservation.product_id, (reservedByProduct.get(reservation.product_id) ?? 0) + reservation.quantity);
  }
  const lowStockProducts = products.filter((product) => product.stock_quantity - (reservedByProduct.get(product.id) ?? 0) <= product.min_stock).length;

  const dashboardData: LeadsDashboardData = {
    dateLabel: dayLabel,
    today: { startIso: today.startIso, endIso: today.endIso },
    kpis: {
      newLeadsToday: leadsToday?.length ?? 0,
      newLeadsYesterday: leadsYesterday?.length ?? 0,
      outboundMessagesToday: messagesToday ?? 0,
      activeConversationsToday: convosToday?.length ?? 0,
      wonToday,
      wonValueTodayCents,
      pipelineValueTodayCents,
    },
    operations: {
      sharedQueueLeads: sharedQueueLeads ?? 0,
      appointmentsToday: appointmentsToday ?? 0,
      overdueTasks: overdueTasks ?? 0,
      lowStockProducts,
      activeReservations: activeReservations.length,
    },
    leadsByHour: buildLeadsByHour(leadsToday ?? [], today.startIso),
    pipelineByStage,
    sourcesToday: aggregateSources(leadsToday ?? []),
    recentToday: (leadsToday ?? []).map((l) => {
      const stage = stageMap.get(l.stage_id ?? "");
      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        source: l.source,
        created_at: l.created_at,
        stageName: stage?.name ?? null,
        stageColor: stage?.color ?? null,
        value_cents: l.value_cents,
      };
    }),
    weekTrend: buildWeekTrend(leadsWeek ?? []),
    starsDistribution,
    starsAverage,
    starsByPeriod,
    funnelPeriod: funnelPeriod.active,
    starsPeriod: starsPeriod.active,
    periodParams: {
      date: sp.date,
      ads: sp.ads,
      funil: sp.funil,
      funilDia: sp.funilDia,
      estrelas: sp.estrelas,
      estrelasDia: sp.estrelasDia,
    },
  };

  const metaAds = await getMetaAdsDashboard({
    adAccountId: tenantMeta?.meta_ad_account_id,
    accessToken: tenantMeta?.meta_ads_access_token,
    datePreset: sp.ads as MetaDatePreset | undefined,
  });
  if (metaAds.status === "ready" && metaAds.rows.length > 0) {
    const crmSalesByAd = await getMetaAdsCrmSales(supabase, ctx.tenantId, metaAds.datePreset);
    let crmSalesTotal = 0;
    let crmRevenueTotal = 0;
    metaAds.rows = metaAds.rows.map((row) => {
      const attribution = crmSalesByAd.get(row.id);
      if (!attribution) return row;
      crmSalesTotal += attribution.sales;
      crmRevenueTotal += attribution.revenueCents;
      return { ...row, crmSales: attribution.sales, crmRevenueCents: attribution.revenueCents };
    });
    metaAds.totals.crmSales = crmSalesTotal;
    metaAds.totals.crmRevenueCents = crmRevenueTotal;
  }

  const canForward = canManageCompanySettings(ctx.role);
  const teamUsers = canForward ? await listTenantUserOptions(ctx.tenantId) : [];
  const forwardUserId = (tenantMeta as { lead_forward_user_id?: string | null } | null)?.lead_forward_user_id ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Leads"
        title="Central de operações"
        description="Painel diário para acompanhar entradas, conversas e desempenho comercial."
        actions={<DashboardDateFilter selectedDate={today.dateStr} todayStr={todayBounds.dateStr} />}
      />
      {canForward && teamUsers.length > 0 && (
        <div className="px-8 pt-6">
          <LeadForwardingControl users={teamUsers} initialForwardUserId={forwardUserId} />
        </div>
      )}
      <LeadsOpsDashboard data={dashboardData} stockEnabled={ctx.tenant.stock_enabled} metaAds={metaAds} />
    </div>
  );
}
