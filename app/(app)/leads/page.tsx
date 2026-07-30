import Link from "next/link";
import { CalendarDays, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canSeeAllLeads } from "@/lib/auth/roles";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import {
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
  getBRTRollingDayBounds,
  getBRTYesterdayBounds,
} from "@/lib/date/brt";
import { NewLeadDialog } from "./new-lead-dialog";
import { ImportCsvDialog } from "./import-csv-dialog";
import { LeadsTable } from "./leads-table";

type LeadDateFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";

const filterOptions: Array<{ value: LeadDateFilter; label: string; href: string }> = [
  { value: "today", label: "Hoje", href: "/leads?entrada=today" },
  { value: "yesterday", label: "Ontem", href: "/leads?entrada=yesterday" },
  { value: "7d", label: "7 dias", href: "/leads?entrada=7d" },
  { value: "30d", label: "30 dias", href: "/leads?entrada=30d" },
  { value: "all", label: "Todos", href: "/leads?entrada=all" },
];

function resolveLeadDateFilter(entrada?: string, dia?: string) {
  const active = (["today", "yesterday", "7d", "30d", "all", "custom"].includes(entrada ?? "")
    ? entrada
    : "all") as LeadDateFilter;

  if (active === "today") {
    return { active, bounds: getBRTDayBounds(), label: "Leads que chegaram hoje" };
  }

  if (active === "yesterday") {
    return { active, bounds: getBRTYesterdayBounds(), label: "Leads que chegaram ontem" };
  }

  if (active === "7d") {
    return { active, bounds: getBRTRollingDayBounds(7), label: "Leads dos últimos 7 dias" };
  }

  if (active === "30d") {
    return { active, bounds: getBRTRollingDayBounds(30), label: "Leads dos últimos 30 dias" };
  }

  if (active === "custom" && dia) {
    const bounds = getBRTDayBoundsFromDateString(dia);
    if (bounds) {
      return {
        active,
        bounds,
        label: `Leads do dia ${dia.split("-").reverse().join("/")}`,
      };
    }
  }

  return { active: "all" as LeadDateFilter, bounds: null, label: "Todos os leads cadastrados" };
}

const LEADS_PAGE_SIZE = 50;

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ entrada?: string; dia?: string; page?: string }> }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const params = await searchParams;
  const dateFilter = resolveLeadDateFilter(params?.entrada, params?.dia);
  const page = Math.max(1, Number(params?.page) || 1);
  const from = (page - 1) * LEADS_PAGE_SIZE;
  const to = from + LEADS_PAGE_SIZE - 1;

  const canAssign = canSeeAllLeads(ctx.role) && ctx.tenant.lead_assignment_enabled;
  // Vendedor com atribuicao ativa no tenant so ve o que foi mandado pra ele
  // (RLS garante isso no banco tambem - aqui e so pra a pagina bater com a
  // contagem certa).
  const restrictToOwn = ctx.tenant.lead_assignment_enabled && !canSeeAllLeads(ctx.role);

  // 500 leads de uma vez travava o scroll da pagina (renderizava tudo numa
  // tabela so). Pagina no servidor em vez de trazer tudo.
  let leadsQuery = supabase
    .from("leads")
    .select("id, name, phone, email, source, value_cents, created_at, stage_id, assigned_to", { count: "exact" })
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (dateFilter.bounds) {
    leadsQuery = leadsQuery.gte("created_at", dateFilter.bounds.startIso).lte("created_at", dateFilter.bounds.endIso);
  }
  if (restrictToOwn) {
    leadsQuery = leadsQuery.eq("assigned_to", ctx.userId);
  }

  const [{ data: leads, count: totalCount }, { data: stages }, members, { data: partners }] = await Promise.all([
    leadsQuery,
    supabase
      .from("pipeline_stages")
      .select("id, name, color")
      .eq("tenant_id", ctx.tenantId)
      .order("position"),
    canAssign ? listTenantUserOptions(ctx.tenantId) : Promise.resolve([]),
    ctx.tenant.field_service_enabled
      ? supabase
          .from("field_service_partners")
          .select("id, kind, name")
          .eq("tenant_id", ctx.tenantId)
          .eq("is_active", true)
          .order("kind")
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const pageCount = Math.max(1, Math.ceil((totalCount ?? 0) / LEADS_PAGE_SIZE));

  function pageHref(target: number) {
    const qs = new URLSearchParams();
    if (params?.entrada) qs.set("entrada", params.entrada);
    if (params?.dia) qs.set("dia", params.dia);
    if (target > 1) qs.set("page", String(target));
    const query = qs.toString();
    return query ? `/leads?${query}` : "/leads";
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operacao"
        title="Leads"
        description={`${dateFilter.label} · ${totalCount ?? 0} resultado${(totalCount ?? 0) === 1 ? "" : "s"}`}
        actions={
          <>
            <ImportCsvDialog />
            <NewLeadDialog stages={stages ?? []} partners={partners ?? []} />
          </>
        }
      />

      <div className="p-8">
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Entrada
            </div>
            {filterOptions.map((option) => (
              <Button key={option.value} asChild size="sm" variant={dateFilter.active === option.value ? "brand" : "outline"}>
                <Link href={option.href}>{option.label}</Link>
              </Button>
            ))}
          </div>

          <form action="/leads" className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="entrada" value="custom" />
            <label htmlFor="lead-entry-day" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Dia específico
            </label>
            <Input
              id="lead-entry-day"
              name="dia"
              type="date"
              defaultValue={dateFilter.active === "custom" ? params?.dia : undefined}
              className={cn("w-full sm:w-44", dateFilter.active === "custom" && "border-brand/60")}
            />
            <Button size="sm" variant="secondary" type="submit">
              Filtrar
            </Button>
          </form>
        </div>

        <LeadsTable
          leads={leads ?? []}
          stages={stages ?? []}
          canAssign={canAssign}
          members={members}
          prevHref={pageHref(Math.max(1, page - 1))}
          nextHref={pageHref(Math.min(pageCount, page + 1))}
          page={page}
          pageCount={pageCount}
          rangeLabel={`${from + 1}–${Math.min(totalCount ?? 0, from + LEADS_PAGE_SIZE)} de ${totalCount ?? 0}`}
        />
      </div>
    </div>
  );
}
