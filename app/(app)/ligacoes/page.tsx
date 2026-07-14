import { notFound } from "next/navigation";
import Link from "next/link";
import { PhoneCall, PhoneOff, Clock, Headphones, User } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchApi4comCalls } from "@/lib/integrations/api4com";
import { cn } from "@/lib/utils";

const ANSWERED_CAUSE = "NORMAL_CLEARING";

export default async function CallsDashboardPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.calls_dashboard_enabled) notFound();

  const allCalls = await fetchApi4comCalls();
  const calls = allCalls
    .filter((c) => (c.metadata as Record<string, unknown> | null)?.tenant_id === ctx.tenantId)
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
  const supabase = await createClient();
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name").in("id", leadIds).eq("tenant_id", ctx.tenantId)
    : { data: [] as { id: string; name: string }[] };
  const leadNames = Object.fromEntries((leads ?? []).map((l) => [l.id, l.name])) as Record<string, string>;

  return (
    <div>
      <PageHeader title="Ligações" description="Chamadas realizadas via Api4com" />

      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<PhoneCall className="h-5 w-5" />} label="Total de Ligações" value={String(total)} />
        <KpiCard icon={<Headphones className="h-5 w-5" />} label="Atendidas" value={`${answered} (${answerRate}%)`} />
        <KpiCard icon={<PhoneOff className="h-5 w-5" />} label="Não Atendidas" value={String(notAnswered)} />
        <KpiCard icon={<Clock className="h-5 w-5" />} label="Duração Média" value={formatDuration(avgDurationSeconds)} />
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
                      <th className="px-5 py-3">Duração</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Gravação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.slice(0, 100).map((c) => {
                      const leadId = (c.metadata as Record<string, unknown> | null)?.lead_id as string | undefined;
                      const wasAnswered = c.duration > 0;
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
                          <td className="px-5 py-3 tabular-nums">{formatDuration(c.duration)}</td>
                          <td className="px-5 py-3">
                            <Badge variant={wasAnswered ? "success" : "destructive"}>
                              {wasAnswered ? "Atendida" : describeHangupCause(c.hangup_cause)}
                            </Badge>
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
