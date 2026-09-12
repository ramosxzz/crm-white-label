import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canSeeAllLeads } from "@/lib/auth/roles";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { PageHeader } from "@/components/app/page-header";
import {
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
  getBRTRollingDayBounds,
  getBRTYesterdayBounds,
} from "@/lib/date/brt";
import { NewLeadDialog } from "./new-lead-dialog";
import { ImportCsvDialog } from "./import-csv-dialog";
import { ExportCsvButton } from "./export-csv-button";
import { LeadsTable } from "./leads-table";
import { LeadsFilters } from "./leads-filters";
import { LeadsSummaryBar, type StageBreakdown } from "./leads-summary-bar";
import { listTagsWithLeadCount } from "./actions";
import { QualificationSummary, type QualificationDistribution } from "./qualification-summary";
import { canFilterLeadsByLocation, normalizeLeadLocationFilter } from "@/lib/leads/location-filter";

type LeadDateFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";
type SortOption = "recentes" | "antigos" | "valor_desc" | "valor_asc" | "qualificacao";

function resolveLeadDateFilter(entrada?: string, dia?: string) {
  const active = (["today", "yesterday", "7d", "30d", "all", "custom"].includes(entrada ?? "")
    ? entrada
    : "all") as LeadDateFilter;

  if (active === "today") return { active, bounds: getBRTDayBounds(), label: "Leads que chegaram hoje" };
  if (active === "yesterday") return { active, bounds: getBRTYesterdayBounds(), label: "Leads que chegaram ontem" };
  if (active === "7d") return { active, bounds: getBRTRollingDayBounds(7), label: "Leads dos últimos 7 dias" };
  if (active === "30d") return { active, bounds: getBRTRollingDayBounds(30), label: "Leads dos últimos 30 dias" };
  if (active === "custom" && dia) {
    const bounds = getBRTDayBoundsFromDateString(dia);
    if (bounds) return { active, bounds, label: `Leads do dia ${dia.split("-").reverse().join("/")}` };
  }
  return { active: "all" as LeadDateFilter, bounds: null, label: "Todos os leads cadastrados" };
}

const LEADS_PAGE_SIZE = 50;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    entrada?: string;
    dia?: string;
    page?: string;
    etapa?: string | string[];
    tag?: string;
    responsavel?: string;
    origem?: string | string[];
    qualificacao?: string;
    ordenar?: string;
    q?: string;
    localizacao?: string;
  }>;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const params = await searchParams;
  const dateFilter = resolveLeadDateFilter(params?.entrada, params?.dia);
  // ?etapa=<id> e ?origem=<valor> repetidos viram array; um so vira string.
  const stageFilterIds = params?.etapa ? (Array.isArray(params.etapa) ? params.etapa : [params.etapa]).filter(Boolean) : [];
  const sourceFilters = params?.origem ? (Array.isArray(params.origem) ? params.origem : [params.origem]).filter(Boolean) : [];
  const tagFilter = params?.tag?.trim() || null;
  const responsavelFilter = params?.responsavel?.trim() || null;
  const qualificacaoFilter = params?.qualificacao?.trim() || null;
  const q = params?.q?.trim() || null;
  const showLocationFilter = canFilterLeadsByLocation(ctx.tenantId);
  const locationFilter = showLocationFilter ? normalizeLeadLocationFilter(params?.localizacao) : null;
  const sort = (["recentes", "antigos", "valor_desc", "valor_asc", "qualificacao"].includes(params?.ordenar ?? "")
    ? params?.ordenar
    : "recentes") as SortOption;
  const page = Math.max(1, Number(params?.page) || 1);
  const from = (page - 1) * LEADS_PAGE_SIZE;
  const to = from + LEADS_PAGE_SIZE - 1;

  const canAssignLeads = canSeeAllLeads(ctx.role);
  const canAssign = canAssignLeads && ctx.tenant.lead_assignment_enabled;
  const minStars = qualificacaoFilter === "5" ? 5 : qualificacaoFilter === "4" ? 4 : qualificacaoFilter === "rated" ? 1 : null;

  // Filtros "amplos" (etapa/tag/periodo) usam o total exato do RPC
  // lead_qualification_summary, que ja roda mesmo assim pro resumo - sem
  // custo extra. Busca/responsavel/origem/qualificacao nao tem suporte no
  // RPC; nesses casos o resultado tende a ser bem menor (filtro estreito),
  // entao um count "exact" direto na query e barato e correto - so nao vira
  // padrao pra tela toda porque contar TODOS os leads do tenant a cada carga
  // (sem filtro nenhum) e que era caro (~400ms medido).
  const useDirectCount = Boolean(q || locationFilter || responsavelFilter || sourceFilters.length > 0 || minStars);

  let leadsQuery = supabase
    .from("leads")
    .select(
      "id, name, phone, email, source, value_cents, created_at, stage_id, assigned_to, quality_stars",
      useDirectCount ? { count: "exact" } : undefined,
    )
    .eq("tenant_id", ctx.tenantId)
    .range(from, to);

  if (sort === "antigos") leadsQuery = leadsQuery.order("created_at", { ascending: true });
  else if (sort === "valor_desc") leadsQuery = leadsQuery.order("value_cents", { ascending: false, nullsFirst: false });
  else if (sort === "valor_asc") leadsQuery = leadsQuery.order("value_cents", { ascending: true, nullsFirst: true });
  else if (sort === "qualificacao") leadsQuery = leadsQuery.order("quality_stars", { ascending: false, nullsFirst: false });
  else leadsQuery = leadsQuery.order("created_at", { ascending: false });

  if (dateFilter.bounds) leadsQuery = leadsQuery.gte("created_at", dateFilter.bounds.startIso).lte("created_at", dateFilter.bounds.endIso);
  if (stageFilterIds.length > 0) leadsQuery = leadsQuery.in("stage_id", stageFilterIds);
  if (tagFilter) leadsQuery = leadsQuery.contains("tags", [tagFilter]);
  if (sourceFilters.length > 0) leadsQuery = leadsQuery.in("source", sourceFilters);
  if (responsavelFilter === "unassigned") leadsQuery = leadsQuery.is("assigned_to", null);
  else if (responsavelFilter) leadsQuery = leadsQuery.eq("assigned_to", responsavelFilter);
  if (minStars) leadsQuery = leadsQuery.gte("quality_stars", minStars);
  if (locationFilter) leadsQuery = leadsQuery.ilike("custom_fields->>address", `%${locationFilter}%`);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const clauses = [`name.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (digits) clauses.push(`phone.ilike.%${digits}%`);
    leadsQuery = leadsQuery.or(clauses.join(","));
  }

  function qualificationCountQuery(stars: number) {
    let query = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("quality_stars", stars);
    if (dateFilter.bounds) query = query.gte("created_at", dateFilter.bounds.startIso).lte("created_at", dateFilter.bounds.endIso);
    if (stageFilterIds.length > 0) query = query.in("stage_id", stageFilterIds);
    if (tagFilter) query = query.contains("tags", [tagFilter]);
    if (sourceFilters.length > 0) query = query.in("source", sourceFilters);
    if (responsavelFilter === "unassigned") query = query.is("assigned_to", null);
    else if (responsavelFilter) query = query.eq("assigned_to", responsavelFilter);
    if (minStars) query = query.gte("quality_stars", minStars);
    if (locationFilter) query = query.ilike("custom_fields->>address", `%${locationFilter}%`);
    if (q) {
      const digits = q.replace(/\D/g, "");
      const clauses = [`name.ilike.%${q}%`, `email.ilike.%${q}%`];
      if (digits) clauses.push(`phone.ilike.%${digits}%`);
      query = query.or(clauses.join(","));
    }
    return query;
  }

  const [
    { data: leads, count: directCount },
    { data: stages },
    members,
    { data: partners },
    qualificationResult,
    directQualificationCounts,
    { data: sourceRows },
    tags,
  ] = await Promise.all([
    leadsQuery,
    supabase.from("pipeline_stages").select("id, name, color").eq("tenant_id", ctx.tenantId).order("position"),
    canAssignLeads ? listTenantUserOptions(ctx.tenantId) : Promise.resolve([]),
    ctx.tenant.field_service_enabled
      ? supabase.from("field_service_partners").select("id, kind, name").eq("tenant_id", ctx.tenantId).eq("is_active", true).order("kind").order("name")
      : Promise.resolve({ data: [] }),
    useDirectCount
      ? Promise.resolve(null)
      : supabase.rpc("lead_qualification_summary", {
          p_tenant_id: ctx.tenantId,
          p_from: dateFilter.bounds?.startIso ?? undefined,
          p_to: dateFilter.bounds?.endIso ?? undefined,
          p_stage_ids: stageFilterIds.length > 0 ? stageFilterIds : undefined,
          p_tag: tagFilter ?? undefined,
        }),
    useDirectCount
      ? Promise.all([0, 1, 2, 3, 4, 5].map((stars) => qualificationCountQuery(stars)))
      : Promise.resolve(null),
    // So os valores distintos de origem, pra popular o filtro - nao precisa
    // ser exato, 5000 linhas mais recentes ja cobre qualquer conjunto real
    // de fontes (poucas dezenas, vindas de integracao fixa).
    supabase.from("leads").select("source").eq("tenant_id", ctx.tenantId).not("source", "is", null).order("created_at", { ascending: false }).limit(5000),
    listTagsWithLeadCount(),
  ]);

  let total = directCount ?? 0;
  let totalValueCents = 0;
  let stageBreakdown: StageBreakdown | null = null;
  let qualificationDistribution: QualificationDistribution | null = null;

  if (!useDirectCount && qualificationResult && !qualificationResult.error) {
    const qualification = (qualificationResult.data ?? []) as Array<{
      stage_id: string | null;
      quality_stars: number;
      lead_count: number;
      value_cents_sum: number;
    }>;
    const stageCountMap = new Map<string | null, number>();
    const qualificationCountMap = new Map<number, number>();
    let metricTotal = 0;
    for (const row of qualification) {
      totalValueCents += row.value_cents_sum ?? 0;
      stageCountMap.set(row.stage_id, (stageCountMap.get(row.stage_id) ?? 0) + row.lead_count);
      qualificationCountMap.set(row.quality_stars, (qualificationCountMap.get(row.quality_stars) ?? 0) + row.lead_count);
      metricTotal += row.lead_count;
    }
    total = metricTotal;
    qualificationDistribution = [0, 1, 2, 3, 4, 5].map((stars) => ({
      stars,
      count: qualificationCountMap.get(stars) ?? 0,
    }));
    // Pula a primeira etapa (equivalente a "Novo Lead"/entrada) - o resumo
    // e sobre o que ja esta em andamento, a contagem de entrada ja aparece
    // no numero total.
    stageBreakdown = (stages ?? [])
      .slice(1)
      .map((s) => ({ name: s.name, count: stageCountMap.get(s.id) ?? 0 }))
      .filter((s) => s.count > 0)
      .slice(0, 4);
  } else if (!useDirectCount) {
    // O resumo e uma otimizacao. Se a migration ainda nao chegou ao ambiente
    // ou o RPC falhar, refaz a distribuicao com counts exatos. Antes o total
    // tinha fallback, mas o painel ficava oculto porque a distribuicao seguia
    // nula justamente no ambiente que ainda nao tinha o RPC disponivel.
    const fallbackQualificationCounts = await Promise.all(
      [0, 1, 2, 3, 4, 5].map((stars) => qualificationCountQuery(stars)),
    );
    qualificationDistribution = fallbackQualificationCounts.map((result, stars) => ({
      stars,
      count: result.count ?? 0,
    }));
    if (fallbackQualificationCounts.every((result) => !result.error)) {
      total = qualificationDistribution.reduce((sum, item) => sum + item.count, 0);
    }
  } else if (directQualificationCounts) {
    qualificationDistribution = directQualificationCounts.map((result, stars) => ({
      stars,
      count: result.count ?? 0,
    }));
  }

  const sourceCounts = new Map<string, number>();
  for (const row of (sourceRows ?? []) as Array<{ source: string | null }>) {
    if (!row.source?.trim()) continue;
    const key = row.source.trim();
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]).map(([source]) => source).slice(0, 30);

  const pageCount = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const hasActiveFilters = Boolean(q || locationFilter || stageFilterIds.length || tagFilter || responsavelFilter || sourceFilters.length || minStars || dateFilter.active !== "all");

  function pageHref(target: number) {
    const qs = new URLSearchParams();
    if (params?.entrada) qs.set("entrada", params.entrada);
    if (params?.dia) qs.set("dia", params.dia);
    for (const id of stageFilterIds) qs.append("etapa", id);
    for (const s of sourceFilters) qs.append("origem", s);
    if (tagFilter) qs.set("tag", tagFilter);
    if (responsavelFilter) qs.set("responsavel", responsavelFilter);
    if (qualificacaoFilter) qs.set("qualificacao", qualificacaoFilter);
    if (q) qs.set("q", q);
    if (locationFilter) qs.set("localizacao", locationFilter);
    if (sort !== "recentes") qs.set("ordenar", sort);
    if (target > 1) qs.set("page", String(target));
    const query = qs.toString();
    return query ? `/leads?${query}` : "/leads";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Leads"
        description="Gerencie e acompanhe seus contatos comerciais."
        actions={
          <>
            <ExportCsvButton startIso={dateFilter.bounds?.startIso ?? null} endIso={dateFilter.bounds?.endIso ?? null} />
            <ImportCsvDialog canAssign={canAssignLeads} members={members} foldersEnabled={ctx.tenant.lead_folders_enabled} />
            <NewLeadDialog
              stages={stages ?? []}
              partners={partners ?? []}
              members={members}
              sources={sources}
              canAssign={canAssignLeads}
            />
          </>
        }
      />

      <div className="space-y-4 p-6 md:p-8">
        <LeadsFilters
          stages={(stages ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          members={members}
          sources={sources}
          tags={(tags ?? []).map((t) => ({ tag: t.tag, count: t.count }))}
          canAssign={canAssignLeads}
          showLocationFilter={canFilterLeadsByLocation(ctx.tenantId)}
        />

        <LeadsSummaryBar
          total={total}
          totalLabel={hasActiveFilters ? "leads encontrados" : "leads"}
          stageBreakdown={stageBreakdown}
          valueCents={totalValueCents}
        />

        {qualificationDistribution && (
          <QualificationSummary total={total} distribution={qualificationDistribution} />
        )}

        <LeadsTable
          leads={leads ?? []}
          stages={stages ?? []}
          canAssign={canAssign}
          members={members}
          prevHref={pageHref(Math.max(1, page - 1))}
          nextHref={pageHref(Math.min(pageCount, page + 1))}
          page={page}
          pageCount={pageCount}
          rangeLabel={`${total === 0 ? 0 : from + 1}–${Math.min(total, from + LEADS_PAGE_SIZE)} de ${total}`}
          hasActiveFilters={hasActiveFilters}
        />
      </div>
    </div>
  );
}
