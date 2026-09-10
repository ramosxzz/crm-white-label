import Link from "next/link";
import { Plus, Zap, PlayCircle, PauseCircle, FileEdit, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageAutomations } from "@/lib/auth/roles";
import { createFlow, updateFlowStatus, deleteFlow } from "./actions";
import { formatRelativeTimeBRT } from "@/lib/date/brt";

const triggerLabels: Record<string, string> = {
  lead_created: "Lead criado",
  stage_changed: "Etapa alterada",
  message_received: "Mensagem recebida",
  message_sent: "Mensagem enviada",
  appointment_created: "Agendamento criado",
  appointment_near: "Agendamento proximo",
  lead_inactive: "Lead inativo",
};

const statusConfig = {
  draft: { label: "Rascunho", variant: "outline" as const, icon: FileEdit },
  active: { label: "Ativo", variant: "default" as const, icon: PlayCircle },
  paused: { label: "Pausado", variant: "secondary" as const, icon: PauseCircle },
};

export default async function AutomationsPage() {
  const ctx = await requireContext();
  const canManage = canManageAutomations(ctx.role);
  const supabase = await createClient();

  const { data: flows } = await supabase
    .from("automation_flows")
    .select("id, name, description, trigger_kinds, status, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .order("updated_at", { ascending: false });

  // Um recorte recente evita baixar um histórico ilimitado na listagem. O log
  // completo continua disponível dentro de cada automação.
  const flowIds = (flows ?? []).map((f) => f.id);
  const { data: recentExecutions } = flowIds.length
    ? await supabase
        .from("automation_executions")
        .select("flow_id, status, started_at, error_message")
        .in("flow_id", flowIds)
        .order("started_at", { ascending: false })
        .limit(2000)
    : { data: [] };

  type RecentExecution = {
    flow_id: string;
    status: string;
    started_at: string;
    error_message: string | null;
  };
  const executionsByFlow = new Map<string, {
    total: number;
    completed: number;
    failed: number;
    last: RecentExecution | null;
  }>();
  for (const execution of recentExecutions ?? []) {
    const flowId = execution.flow_id as string;
    const summary = executionsByFlow.get(flowId) ?? { total: 0, completed: 0, failed: 0, last: null };
    summary.total += 1;
    if (execution.status === "completed") summary.completed += 1;
    if (execution.status === "failed") summary.failed += 1;
    if (!summary.last) summary.last = execution;
    executionsByFlow.set(flowId, summary);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Automações"
        description="Fluxos automáticos disparados por eventos no CRM."
        actions={
          !canManage ? null : (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova automação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar automação</DialogTitle>
              </DialogHeader>
              <form action={createFlow} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" placeholder="Ex: Boas-vindas para novos leads" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input id="description" name="description" placeholder="Para que serve essa automação?" />
                </div>
                <p className="text-xs text-muted-foreground">
                  O gatilho é escolhido dentro do editor, junto com os demais blocos do fluxo.
                </p>
                <Button type="submit" className="w-full">
                  Criar e abrir editor
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          )
        }
      />

      <div className="p-8">
        {!flows || flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-brand/10">
              <Zap className="h-7 w-7 text-brand" />
            </div>
            <div>
              <p className="font-semibold">Nenhuma automação criada</p>
              <p className="text-sm text-muted-foreground">
                Crie seu primeiro fluxo para automatizar tarefas do CRM.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {flows.map((flow) => {
              const sc = statusConfig[flow.status as keyof typeof statusConfig] ?? statusConfig.draft;
              const StatusIcon = sc.icon;
              const execution = executionsByFlow.get(flow.id);
              const lastExecution = execution?.last;
              return (
                <Card key={flow.id} className="group flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold">{flow.name}</p>
                        {flow.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {flow.description}
                          </p>
                        )}
                      </div>
                      <Badge variant={sc.variant} className="shrink-0 gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3.5 w-3.5" />
                      <span className="truncate">
                        {flow.trigger_kinds && flow.trigger_kinds.length > 0
                          ? flow.trigger_kinds.map((k: string) => triggerLabels[k] ?? k).join(", ")
                          : "Sem gatilho definido"}
                      </span>
                      <span className="ml-auto">{execution?.total ?? 0} execuções recentes</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {execution?.completed ?? 0} concluídas
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-destructive">
                        <XCircle className="h-3.5 w-3.5" /> {execution?.failed ?? 0} falhas
                      </span>
                      <p className="col-span-2 text-muted-foreground">
                        {lastExecution
                          ? `Última execução ${formatRelativeTimeBRT(lastExecution.started_at)}`
                          : "Ainda não executada"}
                      </p>
                      {lastExecution?.error_message && (
                        <p className="col-span-2 truncate text-destructive" title={lastExecution.error_message}>
                          {lastExecution.error_message}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/automations/${flow.id}/editor`}>
                          <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                          {canManage ? "Editar" : "Ver"}
                        </Link>
                      </Button>

                      {canManage && flow.status === "active" ? (
                        <form
                          action={async () => {
                            "use server";
                            await updateFlowStatus(flow.id, "paused");
                          }}
                        >
                          <Button variant="outline" size="sm" type="submit">
                            <PauseCircle className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      ) : flow.status === "paused" || flow.status === "draft" ? (
                        <form
                          action={async () => {
                            "use server";
                            await updateFlowStatus(flow.id, "active");
                          }}
                        >
                          <Button variant="outline" size="sm" type="submit">
                            <PlayCircle className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      ) : null}

                      {canManage && (
                        <form
                          action={async () => {
                            "use server";
                            await deleteFlow(flow.id);
                          }}
                        >
                          <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
