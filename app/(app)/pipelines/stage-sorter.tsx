"use client";

import { notify } from "@/lib/ui/feedback";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, GripVertical, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createStage, reorderStages, updateStage } from "./actions";
import { DeleteStageButton } from "./delete-buttons";

type StageRow = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  is_won: boolean;
  trigger_phrase?: string | null;
};

export function StageSorter({
  pipelineId,
  stages,
  canManage,
}: {
  pipelineId: string;
  stages: StageRow[];
  canManage: boolean;
}) {
  const [orderedStages, setOrderedStages] = useState(stages);
  const [pending, startTransition] = useTransition();

  // O form de salvar etapa e um Server Action que revalida a pagina, mas
  // esse state local so era preenchido uma vez no mount - depois de salvar,
  // a tela renderizava de novo com o `stages` novo vindo do server só que
  // esse array local continuava com o valor antigo, entao parecia que nada
  // tinha sido salvo. Sincroniza sempre que o server manda dado novo.
  useEffect(() => {
    setOrderedStages(stages);
  }, [stages]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const stageIds = useMemo(() => orderedStages.map((stage) => stage.id), [orderedStages]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedStages.findIndex((stage) => stage.id === active.id);
    const newIndex = orderedStages.findIndex((stage) => stage.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextStages = arrayMove(orderedStages, oldIndex, newIndex);
    setOrderedStages(nextStages);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("pipeline_id", pipelineId);
        formData.set("ordered_ids", JSON.stringify(nextStages.map((stage) => stage.id)));
        await reorderStages(formData);
      } catch (error) {
        setOrderedStages(orderedStages);
        notify({ title: error instanceof Error ? error.message : "Nao foi possivel reordenar as etapas.", tone: "error" });
      }
    });
  }

  if (orderedStages.length === 0) {
    return (
      <>
        <div className="border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma etapa configurada.
        </div>
        {canManage && <CreateStageForm pipelineId={pipelineId} />}
      </>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-3">
        {orderedStages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-3 border-b border-border/60 py-2 text-sm last:border-0">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color ?? "#9d7e52" }} />
            <span className="flex-1">{stage.name}</span>
            {stage.position === 0 && <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={stageIds} strategy={verticalListSortingStrategy}>
          <div className={cn("space-y-2", pending && "opacity-70")}>
            {orderedStages.map((stage) => (
              <SortableStageRow key={stage.id} stage={stage} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <CreateStageForm pipelineId={pipelineId} />
    </>
  );
}

function SortableStageRow({ stage }: { stage: StageRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Antes era um <form action={updateStage}> puro: se desse certo ou errado
  // a tela ficava do mesmo jeito, sem nenhum aviso - por isso "clico e nao
  // salva" (na verdade ate podia estar salvando, so nao mostrava nada).
  // Agora confirma o que salvou de verdade e avisa se der erro.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaving(true);
    void updateStage(formData)
      .then(() => {
        notify({ title: "Etapa salva", tone: "success" });
        router.refresh();
      })
      .catch((error) => {
        notify({ title: error instanceof Error ? error.message : "Não foi possível salvar a etapa.", tone: "error" });
      })
      .finally(() => setSaving(false));
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-border/70 bg-background/60 px-3 py-2",
        isDragging && "z-10 border-brand/60 bg-card shadow-lg",
      )}
    >
      <button
        type="button"
        className="grid h-8 w-8 touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Arrastar etapa"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color ?? "#9d7e52" }} />
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={stage.id} />
        <Input name="name" defaultValue={stage.name} aria-label="Nome da etapa" className="h-8 min-w-48 flex-1" />
        <input
          name="color"
          type="color"
          defaultValue={stage.color ?? "#9d7e52"}
          aria-label="Cor da etapa"
          className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
        />
        <Input
          name="trigger_phrase"
          defaultValue={stage.trigger_phrase ?? ""}
          aria-label="Frase que move pra essa etapa"
          placeholder="Frase que move pra cá (opcional)"
          className="h-8 min-w-56 flex-1"
        />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <input name="is_won" type="checkbox" defaultChecked={stage.is_won} className="h-3.5 w-3.5 accent-[hsl(var(--brand))]" />
          Etapa de ganho
        </label>
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Salvar etapa" disabled={saving}>
          <Save className="h-3.5 w-3.5" />
        </Button>
      </form>
      <DeleteStageButton stageId={stage.id} stageName={stage.name} />
    </div>
  );
}

function CreateStageForm({ pipelineId }: { pipelineId: string }) {
  return (
    <form action={createStage} className="flex flex-wrap items-center gap-2 pt-2">
      <input type="hidden" name="pipeline_id" value={pipelineId} />
      <Input name="name" required placeholder="Nova etapa" className="h-8 w-56" />
      <input name="color" type="color" defaultValue="#9d7e52" aria-label="Cor da nova etapa" className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" />
      <Button type="submit" size="sm" variant="outline">
        <Plus className="mr-2 h-3.5 w-3.5" />
        Adicionar etapa
      </Button>
    </form>
  );
}
