"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePipeline, deleteStage } from "./actions";

export function DeletePipelineButton({ pipelineId, pipelineName }: { pipelineId: string; pipelineName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      disabled={pending}
      className="h-8 w-8 text-destructive hover:bg-destructive/10"
      title="Excluir funil"
      onClick={() => {
        if (!confirm(`Excluir o funil "${pipelineName}"? Essa acao nao pode ser desfeita.`)) return;
        start(async () => {
          try {
            const formData = new FormData();
            formData.set("id", pipelineId);
            await deletePipeline(formData);
            router.refresh();
          } catch (error) {
            alert(getPipelineErrorMessage(error));
          }
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function DeleteStageButton({ stageId, stageName }: { stageId: string; stageName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={pending}
      className="h-8 w-8 text-destructive hover:bg-destructive/10"
      title="Excluir etapa"
      onClick={() => {
        if (!confirm(`Excluir a etapa "${stageName}"? Essa acao nao pode ser desfeita.`)) return;
        start(async () => {
          try {
            const formData = new FormData();
            formData.set("id", stageId);
            await deleteStage(formData);
            router.refresh();
          } catch (error) {
            alert(getPipelineErrorMessage(error));
          }
        });
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function getPipelineErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Nao foi possivel concluir a acao.";
  if (message.includes("funil com leads")) {
    return "Esse funil ainda tem leads vinculados. Mova os leads para outro funil antes de excluir.";
  }
  if (message.includes("etapa com leads")) {
    return "Essa etapa ainda tem leads vinculados. Mova os leads para outra etapa antes de excluir.";
  }
  if (message.includes("principal")) {
    return "Defina outro funil como principal antes de excluir este.";
  }
  return message;
}
