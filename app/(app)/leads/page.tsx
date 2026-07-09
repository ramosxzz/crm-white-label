import Link from "next/link";
import { CalendarDays, ChevronRight, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhoneBR, formatCurrencyBRL, cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import {
  formatBRTDateShort,
  formatBRTTime,
  getBRTDayBounds,
  getBRTDayBoundsFromDateString,
  getBRTRollingDayBounds,
  getBRTYesterdayBounds,
} from "@/lib/date/brt";
import { NewLeadDialog } from "./new-lead-dialog";
import { ImportCsvDialog } from "./import-csv-dialog";

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

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ entrada?: string; dia?: string }> }) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const params = await searchParams;
  const dateFilter = resolveLeadDateFilter(params?.entrada, params?.dia);

  let leadsQuery = supabase
    .from("leads")
    .select("id, name, phone, email, source, value_cents, created_at, stage_id")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (dateFilter.bounds) {
    leadsQuery = leadsQuery.gte("created_at", dateFilter.bounds.startIso).lte("created_at", dateFilter.bounds.endIso);
  }

  const [{ data: leads }, { data: stages }] = await Promise.all([
    leadsQuery,
    supabase
      .from("pipeline_stages")
      .select("id, name, color")
      .eq("tenant_id", ctx.tenantId)
      .order("position"),
  ]);

  const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader
        eyebrow="Operacao"
        title="Leads"
        description={`${dateFilter.label} · ${leads?.length ?? 0} resultado${(leads?.length ?? 0) === 1 ? "" : "s"}`}
        actions={
          <>
            <ImportCsvDialog />
            <NewLeadDialog stages={stages ?? []} />
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

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Estagio</th>
                <th className="px-5 py-3 font-medium">Origem</th>
                <th className="px-5 py-3 font-medium">Entrada</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {(leads ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <p className="font-medium">Nenhum lead encontrado</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajuste o filtro de entrada, crie um lead manualmente ou importe uma planilha CSV.
                    </p>
                  </td>
                </tr>
              )}
              {leads?.map((l) => {
                const stage = stageMap.get(l.stage_id ?? "");
                return (
                  <tr key={l.id} className="group transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${l.id}`} className="font-medium transition-colors hover:text-brand">
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{formatPhoneBR(l.phone)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.email ?? "-"}</td>
                    <td className="px-5 py-3">
                      {stage ? (
                        <Badge
                          variant="outline"
                          className="font-medium"
                          style={{ borderColor: `${stage.color}55`, color: stage.color ?? undefined }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color ?? undefined }} />
                          {stage.name}
                        </Badge>
                      ) : "-"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{l.source ?? "-"}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatBRTDateShort(l.created_at)} às {formatBRTTime(l.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{formatCurrencyBRL(l.value_cents)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/leads/${l.id}`} className="opacity-0 transition-opacity group-hover:opacity-100">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
