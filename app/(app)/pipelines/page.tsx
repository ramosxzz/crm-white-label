import { GitBranch, Save, Star } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canManageOperationalSetup } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { setDefaultPipeline, updatePipeline } from "./actions";
import { DeletePipelineButton } from "./delete-buttons";
import { PipelineForm } from "./pipeline-form";
import { StageSorter } from "./stage-sorter";

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
                        {!pipeline.is_default && <DeletePipelineButton pipelineId={pipeline.id} pipelineName={pipeline.name} />}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <StageSorter pipelineId={pipeline.id} stages={stages} canManage={canManage} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
