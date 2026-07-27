"use client";

import { notify, confirmDialog } from "@/lib/ui/feedback";
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
      onClick={async () => {
        const confirmed = await confirmDialog({
          title: `Excluir o funil "${pipelineName}"?`,
          description:
            "Os leads nao serao apagados, mas ficarao sem funil/etapa ate serem reorganizados.",
          tone: "danger",
          confirmLabel: "Excluir",
        });
        if (!confirmed) return;
        start(async () => {
          try {
            const formData = new FormData();
            formData.set("id", pipelineId);
            await deletePipeline(formData);
            router.refresh();
          } catch (error) {
            notify({ title: getPipelineErrorMessage(error), tone: "error" });
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
      onClick={async () => {
        const confirmed = await confirmDialog({
          title: `Excluir a etapa "${stageName}"?`,
          description: "Os leads dessa etapa continuarao no funil, mas ficarao sem etapa.",
          tone: "danger",
          confirmLabel: "Excluir",
        });
        if (!confirmed) return;
        start(async () => {
          try {
            const formData = new FormData();
            formData.set("id", stageId);
            await deleteStage(formData);
            router.refresh();
          } catch (error) {
            notify({ title: getPipelineErrorMessage(error), tone: "error" });
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
  if (message.includes("principal")) {
    return "Defina outro funil como principal antes de excluir este.";
  }
  return message;
}
