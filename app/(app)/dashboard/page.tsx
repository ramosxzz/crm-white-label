import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { LeadsOpsDashboard } from "@/components/dashboard/leads-ops-dashboard";
import { SellerDashboard } from "@/components/dashboard/seller-dashboard";
import { PageHeader } from "@/components/app/page-header";
import {
  formatBRTDateLong,
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
} from "@/lib/date/brt";
import {
  aggregateSources,
  buildLeadsByHour,
  buildWeekTrend,
  buildWonWeekTrend,
  type AttentionItem,
  type LeadsDashboardData,
  type PipelineStage,
} from "@/lib/leads/dashboard-metrics";
import { getMetaAdsDashboard, type MetaDatePreset } from "@/lib/meta/ads-insights";
import { getMetaAdsCrmSales } from "@/lib/meta/crm-attribution";
import { canSeeFullDashboard, canManageCompanySettings } from "@/lib/auth/roles";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { LeadForwardingControl } from "@/components/dashboard/lead-forwarding-control";
import { getSellerDashboardMetrics } from "@/lib/dashboard/seller-metrics";
import { resolvePeriodFilter, previousPeriodBounds } from "@/lib/date/period-filter";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    ads?: string;
    funil?: string;
    funilDia?: string;
  }>;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const todayBounds = getBRTDayBounds();
  const sp = await searchParams;

  // Periodo global do pipeline/atividade comercial. Default "todos" mantem o
  // comportamento de quem ja usa a tela: sem escolher nada, segue mostrando
  // o acumulado.
  const period = resolvePeriodFilter(sp.funil, sp.funilDia);
  const prevBounds = previousPeriodBounds(period.bounds);
  // Dia selecionado no filtro (default: hoje). Nao permite futuro.
  const parsed = sp.date ? getBRTDayBoundsFromDateString(sp.date) : null;
  const today = parsed && parsed.dateStr <= todayBounds.dateStr ? parsed : todayBounds;
  const selDate = new Date(today.startIso);
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
  const nowMs = Date.now();
  const fifteenMinutesAgoIso = new Date(nowMs - 15 * 60 * 1000).toISOString();
  const oneHourAgoIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
  const twoHoursAgoIso = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
  const oneDayAgoIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: leadsToday },
    { data: leadsWeek },
    { data: wonWeek },
    { data: stageCounts },
    { data: stages },
    { count: messagesToday },
    { data: convosToday },
    { count: sharedQueueLeads },
    { count: appointmentsToday },
    { count: overdueTasks },
    { count: tasksDueToday },
    { count: meetingsToday },
    { count: awaitingUnder15Minutes },
    { count: awaiting15To60Minutes },
    { count: awaitingOneToTwoHours },
    { count: awaitingTwoTo24Hours },
    { count: awaitingOver24Hours },
    { count: leadsInPeriodCount },
    { count: leadsPreviousPeriodCount },
    { data: wonInPeriodRows },
    productsResult,
    activeReservationsResult,
    { data: tenantMeta },
    { data: profile },
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
      .select("created_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", `${weekStartStr}T00:00:00-03:00`),
    supabase
      .from("leads")
      .select("won_at")
      .eq("tenant_id", ctx.tenantId)
      .not("won_at", "is", null)
      .gte("won_at", `${weekStartStr}T00:00:00-03:00`),
    // Sem recorte de data usa o RPC enxuto de sempre. Com recorte cai no
    // funnel_metrics, que aceita intervalo, ja filtra por leads.created_at e
    // devolve valor por etapa - mais caro (calcula tempo medio), entao so
    // paga quando o usuario realmente filtra.
    period.bounds
      ? supabase.rpc("funnel_metrics", {
          p_tenant_id: ctx.tenantId,
          p_pipeline_id: undefined,
          p_from: period.bounds.startIso,
          p_to: period.bounds.endIso,
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
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).eq("status", "open").gte("due_at", today.startIso).lte("due_at", today.endIso),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("kind", "meeting")
      .neq("status", "cancelled")
      .gte("starts_at", today.startIso)
      .lte("starts_at", today.endIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "aguardando")
      .gte("last_message_at", fifteenMinutesAgoIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "aguardando")
      .gte("last_message_at", oneHourAgoIso)
      .lt("last_message_at", fifteenMinutesAgoIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "aguardando")
      .gte("last_message_at", twoHoursAgoIso)
      .lt("last_message_at", oneHourAgoIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "aguardando")
      .gte("last_message_at", oneDayAgoIso)
      .lt("last_message_at", twoHoursAgoIso),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "aguardando")
      .lt("last_message_at", oneDayAgoIso),
    period.bounds
      ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).gte("created_at", period.bounds.startIso).lte("created_at", period.bounds.endIso)
      : supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId),
    prevBounds
      ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenantId).gte("created_at", prevBounds.startIso).lte("created_at", prevBounds.endIso)
      : Promise.resolve({ count: null }),
    period.bounds
      ? supabase.from("leads").select("id, value_cents").eq("tenant_id", ctx.tenantId).not("won_at", "is", null).gte("won_at", period.bounds.startIso).lte("won_at", period.bounds.endIso)
      : supabase.from("leads").select("id, value_cents").eq("tenant_id", ctx.tenantId).not("won_at", "is", null),
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
    supabase.from("profiles").select("full_name").eq("id", ctx.userId).single(),
  ]);
  const products = productsResult.data ?? [];
  const activeReservations = activeReservationsResult.data ?? [];

  const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));
  const stageRows = (stageCounts ?? []) as Array<{
    stage_id: string | null;
    lead_count: number | string;
    value_cents?: number | string | null;
  }>;
  const stageCountMap = new Map(stageRows.map((row) => [row.stage_id, Number(row.lead_count ?? 0)]));
  const stageValueMap = new Map(
    stageRows.filter((row) => row.value_cents !== undefined).map((row) => [row.stage_id, Number(row.value_cents ?? 0)]),
  );

  const pipelineByStage: PipelineStage[] = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? "#94a3b8",
    count: stageCountMap.get(s.id) ?? 0,
    valueCents: stageValueMap.has(s.id) ? stageValueMap.get(s.id)! : null,
    isWon: s.is_won,
    isLost: s.is_lost,
  }));

  // "Em atendimento" = pipeline aberto menos a primeira etapa (entrada) -
  // ja engajado, nao so recem-chegado. "Oportunidades abertas" = todo o
  // pipeline em aberto (inclui a primeira etapa). Mesma fonte de dado que os
  // cartoes do funil, sem query nova.
  const openStages = pipelineByStage.filter((s) => !s.isWon && !s.isLost);
  const firstOpenStage = openStages[0];
  const openOpportunities = openStages.reduce((a, s) => a + s.count, 0);
  const inProgress = openOpportunities - (firstOpenStage?.count ?? 0);

  const wonInPeriod = wonInPeriodRows?.length ?? 0;
  const wonValueInPeriodCents = (wonInPeriodRows ?? []).reduce((a, l) => a + (l.value_cents ?? 0), 0);

  const reservedByProduct = new Map<string, number>();
  for (const reservation of activeReservations) {
    reservedByProduct.set(reservation.product_id, (reservedByProduct.get(reservation.product_id) ?? 0) + reservation.quantity);
  }
  const lowStockProducts = products.filter((product) => product.stock_quantity - (reservedByProduct.get(product.id) ?? 0) <= product.min_stock).length;

  const attention: AttentionItem[] = [
    {
      id: "awaiting-over-24h",
      label: `conversa${(awaitingOver24Hours ?? 0) === 1 ? "" : "s"} sem retorno há mais de 24h`,
      count: awaitingOver24Hours ?? 0,
      tone: "critical",
      href: "/chat",
    },
    {
      id: "awaiting-2h-24h",
      label: `conversa${(awaitingTwoTo24Hours ?? 0) === 1 ? "" : "s"} aguardando entre 2h e 24h`,
      count: awaitingTwoTo24Hours ?? 0,
      tone: "critical",
      href: "/chat",
    },
    {
      id: "awaiting-1h-2h",
      label: `conversa${(awaitingOneToTwoHours ?? 0) === 1 ? "" : "s"} aguardando entre 1h e 2h`,
      count: awaitingOneToTwoHours ?? 0,
      tone: "warning",
      href: "/chat",
    },
    {
      id: "awaiting-15m-1h",
      label: `conversa${(awaiting15To60Minutes ?? 0) === 1 ? "" : "s"} aguardando entre 15 e 60 min`,
      count: awaiting15To60Minutes ?? 0,
      tone: "warning",
      href: "/chat",
    },
    {
      id: "awaiting-under-15m",
      label: `conversa${(awaitingUnder15Minutes ?? 0) === 1 ? "" : "s"} aguardando há até 15 min`,
      count: awaitingUnder15Minutes ?? 0,
      tone: "info",
      href: "/chat",
    },
    {
      id: "overdue-tasks",
      label: `tarefa${(overdueTasks ?? 0) === 1 ? "" : "s"} atrasada${(overdueTasks ?? 0) === 1 ? "" : "s"}`,
      count: overdueTasks ?? 0,
      tone: "critical",
      href: "/tarefas",
    },
    {
      id: "due-today-tasks",
      label: `tarefa${(tasksDueToday ?? 0) === 1 ? "" : "s"} vence${(tasksDueToday ?? 0) === 1 ? "" : "m"} hoje`,
      count: tasksDueToday ?? 0,
      tone: "warning",
      href: "/tarefas",
    },
    {
      id: "meetings-today",
      label: `reunião${(meetingsToday ?? 0) === 1 ? "" : "ões"} agendada${(meetingsToday ?? 0) === 1 ? "" : "s"} para hoje`,
      count: meetingsToday ?? 0,
      tone: "info",
      href: "/reunioes",
    },
  ];

  const dashboardData: LeadsDashboardData = {
    dateLabel: dayLabel,
    userFirstName: (profile?.full_name?.trim().split(" ")[0]) || "por aqui",
    today: { startIso: today.startIso, endIso: today.endIso },
    kpis: {
      newLeadsInPeriod: leadsInPeriodCount ?? 0,
      newLeadsPreviousPeriod: leadsPreviousPeriodCount ?? null,
      inProgress,
      openOpportunities,
      wonInPeriod,
      wonValueInPeriodCents,
    },
    operations: {
      sharedQueueLeads: sharedQueueLeads ?? 0,
      appointmentsToday: appointmentsToday ?? 0,
      overdueTasks: overdueTasks ?? 0,
      lowStockProducts,
      activeReservations: activeReservations.length,
    },
    attention,
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
    leadsWeekTrend: buildWeekTrend(leadsWeek ?? []),
    wonWeekTrend: buildWonWeekTrend(wonWeek ?? []),
    period: period.active,
    periodParams: {
      date: sp.date,
      ads: sp.ads,
      funil: sp.funil,
      funilDia: sp.funilDia,
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
      {canForward && teamUsers.length > 0 && (
        <div className="px-8 pt-6">
          <LeadForwardingControl users={teamUsers} initialForwardUserId={forwardUserId} />
        </div>
      )}
      <LeadsOpsDashboard
        data={dashboardData}
        stockEnabled={ctx.tenant.stock_enabled}
        metaAds={metaAds}
        stages={(stages ?? []).map((s) => ({ id: s.id, name: s.name }))}
        todayStr={todayBounds.dateStr}
        selectedDate={today.dateStr}
      />
    </div>
  );
}
