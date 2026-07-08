import { ArrowDown, ArrowUp, CheckCircle2, GitBranch, Plus, Save, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitIconButton } from "@/components/ui/submit-icon-button";
import { canManageOperationalSetup } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { createStage, deletePipeline, deleteStage, moveStage, setDefaultPipeline, updatePipeline, updateStage } from "./actions";
import { PipelineForm } from "./pipeline-form";

type StageRow = { id: string; name: string; color: string | null; position: number };
type PipelineRow = { id: string; name: string; is_default: boolean; pipeline_stages: StageRow[] };

export default async function PipelinesPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipelines")
    .select("id, name, is_default, pipeline_stages(id, name, color, position)")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at");
  const pipelines = (data ?? []) as unknown as PipelineRow[];
  const canManage = canManageOperationalSetup(ctx.role);

  return (
    <div>
      <PageHeader eyebrow="Operacao" title="Funis" description="Organize os processos comerciais e de atendimento" />
      <div className="space-y-5 p-6">
        {canManage && (
          <div className="border-b border-border/70 pb-5">
            <PipelineForm />
          </div>
        )}

        {pipelines.length === 0 && (
          <div className="border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            Nenhum funil configurado.
          </div>
        )}

        <div className="grid gap-5">
          {pipelines.map((pipeline) => {
            const stages = [...pipeline.pipeline_stages].sort((a, b) => a.position - b.position);
            return (
              <Card key={pipeline.id}>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-4 w-4 text-brand" />
                      <CardTitle className="text-base">{pipeline.name}</CardTitle>
                      {pipeline.is_default && <Badge variant="success">Principal</Badge>}
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2">
                        <form action={updatePipeline} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={pipeline.id} />
                          <Input name="name" defaultValue={pipeline.name} aria-label="Nome do funil" className="h-8 w-48" />
                          <Button size="icon" variant="outline" className="h-8 w-8" title="Salvar nome">
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                        {!pipeline.is_default && (
                          <form action={setDefaultPipeline}>
                            <input type="hidden" name="id" value={pipeline.id} />
                            <Button size="icon" variant="outline" className="h-8 w-8" title="Definir como principal">
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        )}
                        {!pipeline.is_default && (
                          <form action={deletePipeline}>
                            <input type="hidden" name="id" value={pipeline.id} />
                            <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" title="Excluir funil">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {stages.length === 0 && (
                    <div className="border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhuma etapa configurada.
                    </div>
                  )}
                  {stages.map((stage, index) => (
                    <div key={stage.id} className="flex flex-wrap items-center gap-3 border-b border-border/60 py-2 last:border-0">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color ?? "#9d7e52" }} />
                      {canManage ? (
                        <>
                          <form action={updateStage} className="flex min-w-0 flex-1 items-center gap-2">
                            <input type="hidden" name="id" value={stage.id} />
                            <Input name="name" defaultValue={stage.name} aria-label="Nome da etapa" className="h-8 max-w-64" />
                            <input name="color" type="color" defaultValue={stage.color ?? "#9d7e52"} aria-label="Cor da etapa" className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" />
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Salvar etapa">
                              <Save className="h-3.5 w-3.5" />
                            </Button>
                          </form>
                          <div className="flex items-center gap-1">
                            <form action={moveStage}>
                              <input type="hidden" name="id" value={stage.id} />
                              <input type="hidden" name="direction" value="up" />
                              <SubmitIconButton disabled={index === 0} title="Mover para cima">
                                <ArrowUp className="h-3.5 w-3.5" />
                              </SubmitIconButton>
                            </form>
                            <form action={moveStage}>
                              <input type="hidden" name="id" value={stage.id} />
                              <input type="hidden" name="direction" value="down" />
                              <SubmitIconButton disabled={index === stages.length - 1} title="Mover para baixo">
                                <ArrowDown className="h-3.5 w-3.5" />
                              </SubmitIconButton>
                            </form>
                            <form action={deleteStage}>
                              <input type="hidden" name="id" value={stage.id} />
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir etapa">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </form>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-1 items-center justify-between text-sm">
                          <span>{stage.name}</span>
                          {stage.position === 0 && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      )}
                    </div>
                  ))}
                  {canManage && (
                    <form action={createStage} className="flex flex-wrap items-center gap-2 pt-2">
                      <input type="hidden" name="pipeline_id" value={pipeline.id} />
                      <Input name="name" required placeholder="Nova etapa" className="h-8 w-56" />
                      <input name="color" type="color" defaultValue="#9d7e52" aria-label="Cor da nova etapa" className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" />
                      <Button type="submit" size="sm" variant="outline">
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Adicionar etapa
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
