import Link from "next/link";
import { Plus, Zap, PlayCircle, PauseCircle, FileEdit, Trash2 } from "lucide-react";
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
import { createFlow, updateFlowStatus, deleteFlow } from "./actions";

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
  const supabase = await createClient();

  const { data: flows } = await supabase
    .from("automation_flows")
    .select("id, name, description, trigger_kinds, status, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .order("updated_at", { ascending: false });

  // Count executions per flow
  const flowIds = (flows ?? []).map((f) => f.id);
  const { data: execCounts } = flowIds.length
    ? await supabase
        .from("automation_executions")
        .select("flow_id, status")
        .in("flow_id", flowIds)
    : { data: [] };

  const countsByFlow = (execCounts ?? []).reduce(
    (acc, e) => {
      const fid = e.flow_id as string;
      acc[fid] = (acc[fid] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Automacoes"
        description="Fluxos automaticos disparados por eventos no CRM."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova automacao
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar automacao</DialogTitle>
              </DialogHeader>
              <form action={createFlow} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" placeholder="Ex: Boas-vindas para novos leads" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Descricao (opcional)</Label>
                  <Input id="description" name="description" placeholder="Para que serve essa automacao?" />
                </div>
                <p className="text-xs text-muted-foreground">
                  O gatilho e escolhido dentro do editor, junto com os demais blocos do fluxo.
                </p>
                <Button type="submit" className="w-full">
                  Criar e abrir editor
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {!flows || flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-brand/10">
              <Zap className="h-7 w-7 text-brand" />
            </div>
            <div>
              <p className="font-semibold">Nenhuma automacao criada</p>
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
                      <span className="ml-auto">{countsByFlow[flow.id] ?? 0} execucoes</span>
                    </div>

                    <div className="mt-auto flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href={`/automations/${flow.id}/editor`}>
                          <FileEdit className="mr-1.5 h-3.5 w-3.5" />
                          Editar
                        </Link>
                      </Button>

                      {flow.status === "active" ? (
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
