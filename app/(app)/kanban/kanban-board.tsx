"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, formatPhoneBR } from "@/lib/utils";
import { moveLeadToStage } from "../leads/actions";

type Stage = { id: string; name: string; color: string | null; position: number };
type Lead = {
  id: string;
  name: string;
  phone: string | null;
  value_cents: number | null;
  stage_id: string | null;
  position: number;
  source: string | null;
};

export function KanbanBoard({
  pipelines,
  activePipelineId,
  initialStages,
  initialLeads,
}: {
  pipelines: { id: string; name: string; is_default: boolean }[];
  activePipelineId: string | null;
  initialStages: Stage[];
  initialLeads: Lead[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initialStages);
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Mantem em dia quando o servidor re-renderiza com stages/leads novos
  // (ex: apos criar uma etapa e navegar de volta para o kanban).
  useEffect(() => {
    setStages(initialStages);
  }, [initialStages]);
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: activePipelineId ? `pipeline_id=eq.${activePipelineId}` : undefined },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) => [...prev, payload.new as Lead]);
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) => prev.map((l) => (l.id === (payload.new as Lead).id ? { ...l, ...(payload.new as Lead) } : l)));
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((l) => l.id !== (payload.old as Lead).id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_stages", filter: activePipelineId ? `pipeline_id=eq.${activePipelineId}` : undefined },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setStages((prev) => [...prev, payload.new as Stage].sort((a, b) => a.position - b.position));
          } else if (payload.eventType === "UPDATE") {
            setStages((prev) =>
              prev
                .map((s) => (s.id === (payload.new as Stage).id ? { ...s, ...(payload.new as Stage) } : s))
                .sort((a, b) => a.position - b.position),
            );
          } else if (payload.eventType === "DELETE") {
            setStages((prev) => prev.filter((s) => s.id !== (payload.old as Stage).id));
          }
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activePipelineId]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    stages.forEach((s) => map.set(s.id, []));
    const firstStageId = stages[0]?.id;
    leads.forEach((l) => {
      if (l.stage_id && map.has(l.stage_id)) {
        map.get(l.stage_id)!.push(l);
      } else if (firstStageId) {
        // Lead do funil sem etapa valida (ou etapa de outro funil): cai na
        // primeira coluna para nunca "sumir" da visao do kanban.
        map.get(firstStageId)!.push(l);
      }
    });
    map.forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [leads, stages]);

  const activeLead = leads.find((l) => l.id === activeId) ?? null;

  function findStageOfLead(leadId: string) {
    return leads.find((l) => l.id === leadId)?.stage_id ?? null;
  }

  function findStageFromDropTarget(targetId: string) {
    return stages.find((s) => s.id === targetId)?.id ?? findStageOfLead(targetId);
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeStage = findStageOfLead(String(active.id));
    const overId = String(over.id);
    const overStage = stages.find((s) => s.id === overId)?.id ?? findStageOfLead(overId);
    if (!overStage || activeStage === overStage) return;
    setLeads((prev) =>
      prev.map((l) => (l.id === String(active.id) ? { ...l, stage_id: overStage } : l)),
    );
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const leadId = String(active.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const overId = String(over.id);
    const targetStageId = findStageFromDropTarget(overId) ?? lead.stage_id ?? stages[0]?.id ?? null;
    if (!targetStageId) return;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage_id: targetStageId } : l)),
    );

    const colLeads = leadsByStage.get(targetStageId) ?? [];
    let newIndex = colLeads.length;
    if (overId !== targetStageId) {
      newIndex = colLeads.findIndex((l) => l.id === overId);
      if (newIndex < 0) newIndex = colLeads.length;
    }
    const position = newIndex * 1000;

    try {
      await moveLeadToStage(leadId, targetStageId, position);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-3">
          <label htmlFor="pipeline-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Funil
          </label>
          <select
            id="pipeline-select"
            value={activePipelineId ?? ""}
            onChange={(event) => router.push(`/kanban?pipeline=${event.target.value}`)}
            className="h-9 min-w-64 rounded-md border border-border bg-card px-3 text-sm font-medium outline-none transition-colors focus:border-brand"
          >
            {pipelines.length === 0 && <option value="">Nenhum funil configurado</option>}
            {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </select>
        </div>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const stageLeads = leadsByStage.get(stage.id) ?? [];
            const total = stageLeads.reduce((acc, l) => acc + (l.value_cents ?? 0), 0);
            return (
              <Column key={stage.id} stage={stage} leads={stageLeads} total={total} />
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} dragging />}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ stage, leads, total }: { stage: Stage; leads: Lead[]; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const color = stage.color ?? "#94a3b8";
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[320px] shrink-0 flex-col rounded-xl border bg-card/40 backdrop-blur-sm transition-colors duration-150 ${
        isOver ? "border-brand/50 bg-brand-muted ring-1 ring-brand/20 dark:border-brand/60 dark:bg-brand/5 dark:ring-brand/30" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/70 p-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}80` }} />
          <span className="font-display text-sm font-semibold">{stage.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {leads.length}
          </span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">{formatCurrencyBRL(total)}</span>
      </div>

      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
          {leads.map((l) => (
            <LeadCard key={l.id} lead={l} stageColor={color} />
          ))}
          {leads.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center text-xs text-muted-foreground">
              Solte um lead aqui
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function LeadCard({ lead, dragging, stageColor }: { lead: Lead; dragging?: boolean; stageColor?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || dragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group cursor-grab rounded-lg border border-border/70 bg-card p-3.5 shadow-elev-1 transition-colors duration-150 hover:border-brand/35 hover:shadow-elev-2 active:cursor-grabbing"
    >
      <Link
        href={`/leads/${lead.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="block font-medium leading-tight transition-colors group-hover:text-brand"
      >
        {lead.name}
      </Link>
      {lead.phone && (
        <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Phone className="h-3 w-3" />
          {formatPhoneBR(lead.phone)}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px]">
        {lead.source ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{lead.source}</span>
        ) : <span />}
        <span className="font-mono font-semibold" style={{ color: stageColor }}>
          {formatCurrencyBRL(lead.value_cents)}
        </span>
      </div>
    </div>
  );
}
