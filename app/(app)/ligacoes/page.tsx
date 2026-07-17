import { notFound } from "next/navigation";
import Link from "next/link";
import { PhoneCall, PhoneOff, Clock, Headphones, User } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CallButton } from "@/components/leads/call-button";
import { fetchApi4comCalls } from "@/lib/integrations/api4com";
import { cn } from "@/lib/utils";

const ANSWERED_CAUSE = "NORMAL_CLEARING";
type CallLeadRow = { id: string; name: string; pipeline_id: string | null; stage_id: string | null };
type NameRow = { id: string; name: string };

type SearchParams = { from?: string | string[]; to?: string | string[]; preset?: string | string[] };

export default async function CallsDashboardPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const ctx = await requireContext();
  if (!ctx.tenant.calls_dashboard_enabled) notFound();
  const params = (await searchParams) ?? {};
  const range = getDateRange(params);

  const allCalls = await fetchApi4comCalls();
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

  // Tentativas por lead/destino: cada ligacao para o mesmo lead (ou, sem lead,
  // o mesmo numero de destino) conta como uma tentativa de contato.
  const contactKey = (c: (typeof calls)[number]) =>
    ((c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined) ?? c.to;
  const attemptsByKey = new Map<string, number>();
  for (const c of calls) {
    const k = contactKey(c);
    attemptsByKey.set(k, (attemptsByKey.get(k) ?? 0) + 1);
  }
  const contactedCount = attemptsByKey.size;
  const avgAttempts = contactedCount > 0 ? (total / contactedCount).toFixed(1) : "0";

  // Ordinal de cada ligacao entre as tentativas do mesmo lead (1a, 2a, ...),
  // contando da mais antiga para a mais recente.
  const ordinalByCall = new Map<string, number>();
  const running = new Map<string, number>();
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i];
    const k = contactKey(c);
    const n = (running.get(k) ?? 0) + 1;
    running.set(k, n);
    ordinalByCall.set(c.id, n);
  }
  const supabase = await createClient();

  const { data: leads } = leadIds.length
    ? await (supabase as any).from("leads").select("id, name, pipeline_id, stage_id").in("id", leadIds).eq("tenant_id", ctx.tenantId)
    : { data: [] as { id: string; name: string; pipeline_id: string | null; stage_id: string | null }[] };
  const leadRows = (leads ?? []) as CallLeadRow[];
  const leadNames = Object.fromEntries(leadRows.map((l) => [l.id, l.name])) as Record<string, string>;
  const leadBusiness = Object.fromEntries(
    leadRows.map((lead) => [
      lead.id,
      {
        pipelineId: lead.pipeline_id,
        stageId: lead.stage_id,
      },
    ]),
  ) as Record<string, { pipelineId: string | null; stageId: string | null }>;
  const { data: pipelines } = await (supabase as any)
    .from("pipelines")
    .select("id, name")
    .eq("tenant_id", ctx.tenantId);
  const { data: stages } = await (supabase as any)
    .from("pipeline_stages")
    .select("id, name")
    .eq("tenant_id", ctx.tenantId);
  const pipelineNames = Object.fromEntries(((pipelines ?? []) as NameRow[]).map((pipeline) => [pipeline.id, pipeline.name])) as Record<string, string>;
  const stageNames = Object.fromEntries(((stages ?? []) as NameRow[]).map((stage) => [stage.id, stage.name])) as Record<string, string>;

  return (
    <div>
      <PageHeader title="Ligações" description="Chamadas realizadas via Api4com" />

      <form className="mx-6 mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="calls-from">
            De
          </label>
          <Input id="calls-from" name="from" type="date" defaultValue={formatDateInput(range.from)} className="h-9 w-40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="calls-to">
            Até
          </label>
          <Input id="calls-to" name="to" type="date" defaultValue={formatDateInput(range.to)} className="h-9 w-40" />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
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
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ligações</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {calls.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Nenhuma ligação registrada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Ramal</th>
                      <th className="px-5 py-3">Destino</th>
                      <th className="px-5 py-3">Lead</th>
                      <th className="px-5 py-3">Funil</th>
                      <th className="px-5 py-3">Etapa</th>
                      <th className="px-5 py-3">Tentativas</th>
                      <th className="px-5 py-3">Duração</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-center">Ligar</th>
                      <th className="px-5 py-3">Gravação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.slice(0, 100).map((c) => {
                      const leadId = (c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined;
                      const wasAnswered = c.duration > 0;
                      const attempts = attemptsByKey.get(contactKey(c)) ?? 1;
                      const ordinal = ordinalByCall.get(c.id) ?? 1;
                      const business = leadId ? leadBusiness[leadId] : null;
                      return (
                        <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3 text-muted-foreground">
                            {new Date(c.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-5 py-3 font-mono">{c.from}</td>
                          <td className="px-5 py-3 font-mono">{c.to}</td>
                          <td className="px-5 py-3">
                            {leadId ? (
                              <Link href={`/leads/${leadId}`} prefetch className="inline-flex items-center gap-1 text-brand hover:underline">
                                <User className="h-3.5 w-3.5" /> {leadNames[leadId] ?? "Ver lead"}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {business?.pipelineId ? (
                              <span className="max-w-48 truncate text-muted-foreground">{pipelineNames[business.pipelineId] ?? "-"}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {business?.stageId ? (
                              <Badge variant="outline">{stageNames[business.stageId] ?? "Etapa"}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="secondary" className="tabular-nums" title={`${attempts} tentativa(s) no total`}>
                              {ordinal}ª de {attempts}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 tabular-nums">{formatDuration(c.duration)}</td>
                          <td className="px-5 py-3">
                            <Badge variant={wasAnswered ? "success" : "destructive"}>
                              {wasAnswered ? "Atendida" : describeHangupCause(c.hangup_cause)}
                            </Badge>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-center">
                              <CallButton leadId={leadId} phone={c.to} iconOnly />
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {c.record_url ? (
                              <a href={c.record_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                                Ouvir
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
