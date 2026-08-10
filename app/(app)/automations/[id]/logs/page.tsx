import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, Clock, Zap } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { formatBRTFullDateTime } from "@/lib/date/brt";

const statusConfig = {
  running: { label: "Executando", icon: Clock, color: "text-blue-600" },
  completed: { label: "Concluido", icon: CheckCircle, color: "text-green-600" },
  failed: { label: "Falhou", icon: XCircle, color: "text-red-600" },
  cancelled: { label: "Cancelado", icon: XCircle, color: "text-muted-foreground" },
};

export default async function AutomationLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: flow } = await supabase
    .from("automation_flows")
    .select("id, name, trigger_kind, status")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!flow) notFound();

  const { data: executions } = await supabase
    .from("automation_executions")
    .select(
      "id, status, trigger_kind, trigger_payload, started_at, finished_at, error_message, lead_id",
    )
    .eq("flow_id", id)
    .eq("tenant_id", ctx.tenantId)
    .order("started_at", { ascending: false })
    .limit(100);

  // Fetch lead names for display
  // .filter(Boolean) nao estreita (string|null)[] pra string[] no TS - precisa
  // de um predicado de tipo explicito.
  const leadIds = [
    ...new Set((executions ?? []).map((e) => e.lead_id).filter((id): id is string => id != null)),
  ];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, name").in("id", leadIds)
    : { data: [] };

  const leadsById = Object.fromEntries((leads ?? []).map((l) => [l.id, l.name]));

  const stats = {
    total: executions?.length ?? 0,
    completed: executions?.filter((e) => e.status === "completed").length ?? 0,
    failed: executions?.filter((e) => e.status === "failed").length ?? 0,
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-8 py-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href={`/automations/${id}/editor`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-semibold">{flow.name} — Logs</h1>
          <p className="text-xs text-muted-foreground">Historico de execucoes</p>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Concluidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </CardContent>
          </Card>
        </div>

        {/* Execution list */}
        {!executions || executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 py-16 text-center">
            <Zap className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma execucao registrada ainda.</p>
            <p className="text-xs text-muted-foreground/60">
              Ative o fluxo para que as execucoes apareçam aqui.
            </p>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Execucoes recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {executions.map((exec) => {
                  const sc =
                    statusConfig[exec.status as keyof typeof statusConfig] ?? statusConfig.running;
                  const StatusIcon = sc.icon;
                  const leadName = exec.lead_id ? (leadsById[exec.lead_id] ?? "Lead removido") : "—";
                  const duration =
                    exec.finished_at && exec.started_at
                      ? Math.round(
                          (new Date(exec.finished_at).getTime() -
                            new Date(exec.started_at).getTime()) /
                            1000,
                        )
                      : null;

                  return (
                    <div key={exec.id} className="flex items-start gap-3 px-4 py-3">
                      <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${sc.color}`} />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium truncate">{leadName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBRTFullDateTime(exec.started_at)}
                          {duration !== null && ` · ${duration}s`}
                        </p>
                        {exec.error_message && (
                          <p className="text-xs text-red-500 truncate">{exec.error_message}</p>
                        )}
                      </div>
                      <Badge
                        variant={exec.status === "completed" ? "default" : "outline"}
                        className={`shrink-0 text-[10px] ${
                          exec.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : exec.status === "failed"
                              ? "border-red-200 text-red-600"
                              : ""
                        }`}
                      >
                        {sc.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
