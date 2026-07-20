import { notFound } from "next/navigation";
import Link from "next/link";
import { PhoneCall, PhoneOff, Clock, Headphones, User } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi4comCalls } from "@/lib/integrations/api4com";
import { cn } from "@/lib/utils";
import { CallsTable, type CallRow } from "./calls-table";
import { CallsFunnel } from "./calls-funnel";
import type { CallOutcome } from "./call-outcomes";

const ANSWERED_CAUSE = "NORMAL_CLEARING";
type CallLeadRow = { id: string; name: string; phone: string | null; pipeline_id: string | null; stage_id: string | null; tags: string[] | null };
type NameRow = { id: string; name: string };

type SearchParams = {
  from?: string | string[];
  to?: string | string[];
  preset?: string | string[];
  stage?: string | string[];
  tag?: string | string[];
};

export default async function CallsDashboardPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const ctx = await requireContext();
  if (!ctx.tenant.calls_dashboard_enabled) notFound();
  const params = (await searchParams) ?? {};
  const range = getDateRange(params);
  const stageFilter = firstParam(params.stage) || "";
  const tagFilter = firstParam(params.tag) || "";

  const supabase = await createClient();

  const [allCalls, pipelinesRes, users, outcomesRes] = await Promise.all([
    fetchApi4comCalls(),
    supabase
      .from("pipelines")
      .select("id, name, pipeline_stages(id, name, color, position)")
      .eq("tenant_id", ctx.tenantId)
      .order("name"),
    listTenantUserOptions(ctx.tenantId),
    supabase.from("call_attempts").select("api4com_call_id, lead_id, outcome").eq("tenant_id", ctx.tenantId),
  ]);

  const pipelineOptions = ((pipelinesRes.data ?? []) as {
    id: string;
    name: string;
    pipeline_stages: { id: string; name: string; color: string | null; position: number | null }[] | null;
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    stages: (p.pipeline_stages ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  }));
  const allStages = pipelineOptions.flatMap((p) => p.stages);

  const outcomeByCallId = new Map<string, CallOutcome>();
  for (const row of (outcomesRes.data ?? []) as { api4com_call_id: string | null; lead_id: string | null; outcome: string }[]) {
    if (row.api4com_call_id) outcomeByCallId.set(row.api4com_call_id, row.outcome as CallOutcome);
  }

  const calls = allCalls
    .filter((c) => (c.metadata as Record<string, unknown> | null)?.tenant_id === ctx.tenantId)
    .filter((c) => {
      const time = new Date(c.started_at).getTime();
      return time >= range.from.getTime() && time <= range.to.getTime();
    })
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  const total = calls.length;
  const answered = calls.filter((c) => c.duration > 0).length;
  const notAnswered = total - answered;
  const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;
  const totalTalkSeconds = calls.reduce((acc, c) => acc + c.duration, 0);
  const avgDurationSeconds = answered > 0 ? Math.round(totalTalkSeconds / answered) : 0;

  const leadIds = Array.from(
    new Set(
      calls
        .map((c) => (c.metadata as Record<string, unknown> | null)?.lead_id)
        .filter((v): v is string => typeof v === "string"),
    ),
  );

  const contactKey = (c: (typeof calls)[number]) =>
    ((c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined) ?? c.to;
  const attemptsByKey = new Map<string, number>();
  for (const c of calls) {
    const k = contactKey(c);
    attemptsByKey.set(k, (attemptsByKey.get(k) ?? 0) + 1);
  }
  const contactedCount = attemptsByKey.size;
  const avgAttempts = contactedCount > 0 ? (total / contactedCount).toFixed(1) : "0";

  const ordinalByCall = new Map<string, number>();
  const running = new Map<string, number>();
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i];
    const k = contactKey(c);
    const n = (running.get(k) ?? 0) + 1;
    running.set(k, n);
    ordinalByCall.set(c.id, n);
  }

  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name, phone, pipeline_id, stage_id, tags").in("id", leadIds).eq("tenant_id", ctx.tenantId)
    : { data: [] as CallLeadRow[] };
  const leadRows = (leads ?? []) as CallLeadRow[];
  const leadById = new Map(leadRows.map((l) => [l.id, l]));
  const { data: stages } = await supabase.from("pipeline_stages").select("id, name").eq("tenant_id", ctx.tenantId);
  const stageNames = Object.fromEntries(((stages ?? []) as NameRow[]).map((stage) => [stage.id, stage.name])) as Record<string, string>;
  const pipelineNameById = Object.fromEntries(pipelineOptions.map((p) => [p.id, p.name])) as Record<string, string>;

  const allTags = Array.from(new Set(leadRows.flatMap((l) => l.tags ?? []))).sort();

  const rows: CallRow[] = calls
    .filter((c) => {
      if (!stageFilter) return true;
      const leadId = (c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined;
      const lead = leadId ? leadById.get(leadId) : null;
      return lead?.stage_id === stageFilter;
    })
    .filter((c) => {
      if (!tagFilter) return true;
      const leadId = (c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined;
      const lead = leadId ? leadById.get(leadId) : null;
      return (lead?.tags ?? []).includes(tagFilter);
    })
    .slice(0, 100)
    .map((c) => {
      const leadId = (c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined;
      const lead = leadId ? leadById.get(leadId) : null;
      return {
        id: c.id,
        startedAt: c.started_at,
        from: c.from,
        to: c.to,
        leadId: leadId ?? null,
        leadName: lead?.name ?? null,
        leadPhone: lead?.phone ?? null,
        pipelineName: lead?.pipeline_id ? pipelineNameById[lead.pipeline_id] ?? null : null,
        stageName: lead?.stage_id ? stageNames[lead.stage_id] ?? null : null,
        attempts: attemptsByKey.get(contactKey(c)) ?? 1,
        ordinal: ordinalByCall.get(c.id) ?? 1,
        duration: c.duration,
        wasAnswered: c.duration > 0,
        hangupLabel: describeHangupCause(c.hangup_cause),
        recordUrl: c.record_url,
        outcome: outcomeByCallId.get(c.id) ?? "feita",
      };
    });

  const outcomeCounts: Record<string, number> = { feita: total };
  for (const outcome of outcomeByCallId.values()) {
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader title="Ligações" description="Chamadas realizadas via Api4com" />

      <form className="mx-6 mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="calls-from">De</label>
          <Input id="calls-from" name="from" type="date" defaultValue={formatDateInput(range.from)} className="h-9 w-40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="calls-to">Até</label>
          <Input id="calls-to" name="to" type="date" defaultValue={formatDateInput(range.to)} className="h-9 w-40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="calls-stage">Etapa</label>
          <select id="calls-stage" name="stage" defaultValue={stageFilter} className="h-9 w-44 rounded-md border border-input bg-background px-2.5 text-sm">
            <option value="">Todas</option>
            {allStages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="calls-tag">Tag</label>
          <select id="calls-tag" name="tag" defaultValue={tagFilter} className="h-9 w-40 rounded-md border border-input bg-background px-2.5 text-sm">
            <option value="">Todas</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="sm">Filtrar</Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={range.preset === "today" ? "brand" : "outline"} size="sm">
            <Link href="/ligacoes?preset=today" prefetch>Hoje</Link>
          </Button>
          <Button asChild variant={range.preset === "7d" ? "brand" : "outline"} size="sm">
            <Link href="/ligacoes?preset=7d" prefetch>7 dias</Link>
          </Button>
          <Button asChild variant={range.preset === "30d" ? "brand" : "outline"} size="sm">
            <Link href="/ligacoes?preset=30d" prefetch>30 dias</Link>
          </Button>
        </div>
      </form>

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={<PhoneCall className="h-5 w-5" />} label="Total de Ligações" value={String(total)} />
        <KpiCard icon={<Headphones className="h-5 w-5" />} label="Atendidas" value={`${answered} (${answerRate}%)`} />
        <KpiCard icon={<PhoneOff className="h-5 w-5" />} label="Não Atendidas" value={String(notAnswered)} />
        <KpiCard icon={<Clock className="h-5 w-5" />} label="Duração Média" value={formatDuration(avgDurationSeconds)} />
        <KpiCard icon={<User className="h-5 w-5" />} label="Leads Contatados" value={String(contactedCount)} />
        <KpiCard icon={<PhoneCall className="h-5 w-5" />} label="Tentativas / Lead" value={avgAttempts} />
      </div>

      <div className="px-6 pb-6">
        <CallsFunnel counts={outcomeCounts} />
      </div>

      <div className="px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ligações</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CallsTable calls={rows} pipelineOptions={pipelineOptions} users={users} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/20">
          {icon}
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={cn("font-display block text-xl font-semibold")}>{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseDateInput(value: string | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getDateRange(params: SearchParams) {
  const preset = firstParam(params.preset);
  const today = new Date();
  if (preset === "today") return { from: startOfDay(today), to: endOfDay(today), preset };
  if (preset === "30d") {
    const from = startOfDay(today);
    from.setDate(from.getDate() - 29);
    return { from, to: endOfDay(today), preset };
  }
  if (preset === "7d") {
    const from = startOfDay(today);
    from.setDate(from.getDate() - 6);
    return { from, to: endOfDay(today), preset };
  }

  const parsedFrom = parseDateInput(firstParam(params.from));
  const parsedTo = parseDateInput(firstParam(params.to));
  const fallbackFrom = startOfDay(today);
  fallbackFrom.setDate(fallbackFrom.getDate() - 6);
  return {
    from: parsedFrom ? startOfDay(parsedFrom) : fallbackFrom,
    to: parsedTo ? endOfDay(parsedTo) : endOfDay(today),
    preset: preset ?? "custom",
  };
}

function formatDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function describeHangupCause(cause: string): string {
  switch (cause) {
    case ANSWERED_CAUSE:
      return "Atendida";
    case "NO_ANSWER":
      return "Não atendeu";
    case "ORIGINATOR_CANCEL":
      return "Cancelada";
    case "UNALLOCATED_NUMBER":
      return "Número inválido";
    case "NUMBER_CHANGED":
      return "Número alterado";
    default:
      return "Falhou";
  }
}
