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
import { Phone, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyBRL, formatPhoneBR, cn } from "@/lib/utils";
import { moveLeadToStage } from "../leads/actions";
import { CallButton } from "@/components/leads/call-button";
import { WhatsAppCallButton } from "@/components/leads/whatsapp-call-button";
import { StarRating } from "@/components/leads/star-rating";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { setLeadQualityStars } from "../ligacoes/actions";
import { updateChatLeadTags } from "../chat/actions";

type Stage = { id: string; name: string; color: string | null; position: number };
type Lead = {
  id: string;
  name: string;
  phone: string | null;
  value_cents: number | null;
  stage_id: string | null;
  position: number;
  source: string | null;
  tags: string[] | null;
  quality_stars: number | null;
  created_at: string;
};

type ArrivedFilter = "todos" | "hoje" | "ontem" | "personalizado";

type KanbanFilters = {
  tag: string;
  minStars: number;
  arrived: ArrivedFilter;
  arrivedDate: string;
};

const DEFAULT_KANBAN_FILTERS: KanbanFilters = {
  tag: "todos",
  minStars: 0,
  arrived: "todos",
  arrivedDate: "",
};

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function matchesArrivedFilter(createdAt: string | null, filter: ArrivedFilter, customDate: string): boolean {
  if (filter === "todos") return true;
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (filter === "hoje") return isSameDay(created, new Date());
  if (filter === "ontem") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(created, yesterday);
  }
  if (filter === "personalizado") {
    if (!customDate) return true;
    const [y, m, d] = customDate.split("-").map(Number);
    if (!y || !m || !d) return true;
    return isSameDay(created, new Date(y, m - 1, d));
  }
  return true;
}

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
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<KanbanFilters>(DEFAULT_KANBAN_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<KanbanFilters>(DEFAULT_KANBAN_FILTERS);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) for (const tag of l.tags ?? []) set.add(tag);
    return [...set].sort();
  }, [leads]);

  const activeFilterCount = Object.entries(appliedFilters).filter(
    ([key, value]) => value !== DEFAULT_KANBAN_FILTERS[key as keyof KanbanFilters],
  ).length;

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_KANBAN_FILTERS);
    setAppliedFilters(DEFAULT_KANBAN_FILTERS);
    setFiltersOpen(false);
  }

  function leadMatchesFilters(lead: Lead) {
    if (appliedFilters.tag !== "todos" && !(lead.tags ?? []).includes(appliedFilters.tag)) return false;
    if (appliedFilters.minStars > 0 && (lead.quality_stars ?? 0) < appliedFilters.minStars) return false;
    if (!matchesArrivedFilter(lead.created_at, appliedFilters.arrived, appliedFilters.arrivedDate)) return false;
    return true;
  }

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
  const normalizedSearch = useMemo(() => normalizeKanbanSearch(search), [search]);
  const searchDigits = useMemo(() => onlyDigits(search), [search]);
  const hasSearch = Boolean(normalizedSearch || searchDigits);
  const isFiltering = hasSearch || activeFilterCount > 0;

  const visibleLeadsByStage = useMemo(() => {
    if (!isFiltering) return leadsByStage;
    const map = new Map<string, Lead[]>();
    stages.forEach((stage) => {
      const stageLeads = leadsByStage.get(stage.id) ?? [];
      map.set(
        stage.id,
        stageLeads.filter(
          (lead) =>
            (!hasSearch || leadMatchesSearch(lead, normalizedSearch, searchDigits)) && leadMatchesFilters(lead),
        ),
      );
    });
    return map;
  }, [isFiltering, hasSearch, leadsByStage, normalizedSearch, searchDigits, stages, appliedFilters]);

  const visibleLeadCount = useMemo(
    () => Array.from(visibleLeadsByStage.values()).reduce((total, stageLeads) => total + stageLeads.length, 0),
    [visibleLeadsByStage],
  );

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
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-3 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <label htmlFor="pipeline-select" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Funil
            </label>
            <select
              id="pipeline-select"
              value={activePipelineId ?? ""}
              onChange={(event) => router.push(`/kanban?pipeline=${event.target.value}`)}
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm font-medium outline-none transition-colors focus:border-brand sm:min-w-64"
            >
              {pipelines.length === 0 && <option value="">Nenhum funil configurado</option>}
              {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar lead por nome ou telefone..."
                className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Limpar pesquisa"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={openFilters}
              className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {isFiltering && (
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                {visibleLeadCount} de {leads.length} lead{leads.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const stageLeads = visibleLeadsByStage.get(stage.id) ?? [];
            const total = stageLeads.reduce((acc, l) => acc + (l.value_cents ?? 0), 0);
            return (
              <Column key={stage.id} stage={stage} leads={stageLeads} total={total} isFiltering={isFiltering} />
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeLead && <LeadCard lead={activeLead} dragging />}
      </DragOverlay>
    </DndContext>

    {filtersOpen && (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} aria-hidden />
        <div className="relative flex h-full w-full max-w-sm flex-col bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-4">
            <h3 className="text-base font-semibold">Filtros</h3>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tags</label>
              <select
                value={draftFilters.tag}
                onChange={(e) => setDraftFilters((f) => ({ ...f, tag: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value="todos">Todas</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Qualidade mín.</label>
              <select
                value={draftFilters.minStars}
                onChange={(e) => setDraftFilters((f) => ({ ...f, minStars: Number(e.target.value) }))}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value={0}>Qualquer</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Lead chegou</label>
              <select
                value={draftFilters.arrived}
                onChange={(e) => setDraftFilters((f) => ({ ...f, arrived: e.target.value as ArrivedFilter }))}
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value="todos">Qualquer data</option>
                <option value="hoje">Hoje</option>
                <option value="ontem">Ontem</option>
                <option value="personalizado">Data personalizada</option>
              </select>
              {draftFilters.arrived === "personalizado" && (
                <input
                  type="date"
                  value={draftFilters.arrivedDate}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, arrivedDate: e.target.value }))}
                  className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                />
              )}
            </div>
          </div>

          <div className="flex gap-2 border-t border-border/60 px-4 py-4">
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 flex-1 rounded-md border border-border text-sm font-medium text-muted-foreground hover:bg-muted/40"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className={cn(
                "h-9 flex-1 rounded-md bg-brand text-sm font-medium text-brand-foreground hover:opacity-90",
              )}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function normalizeKanbanSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function leadMatchesSearch(lead: Lead, searchText: string, searchDigits: string) {
  const searchableText = normalizeKanbanSearch([lead.name, lead.phone, lead.source].filter(Boolean).join(" "));
  const searchableDigits = onlyDigits([lead.phone, lead.name].filter(Boolean).join(" "));
  return Boolean(
    (searchText && searchableText.includes(searchText)) ||
      (searchDigits && searchableDigits.includes(searchDigits)),
  );
}

function Column({ stage, leads, total, isFiltering }: { stage: Stage; leads: Lead[]; total: number; isFiltering: boolean }) {
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
              {isFiltering ? "Nenhum lead encontrado nesta etapa" : "Solte um lead aqui"}
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
  const [stars, setStars] = useState(lead.quality_stars ?? 0);
  const [tags, setTags] = useState<string[]>(lead.tags ?? []);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || dragging ? 0.4 : 1,
  };

  function changeStars(next: number) {
    setStars(next);
    void setLeadQualityStars({ leadId: lead.id, stars: next }).catch(() => null);
  }

  function addTag() {
    const value = tagDraft.trim();
    if (!value) {
      setTagOpen(false);
      return;
    }
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTagDraft("");
      setTagOpen(false);
      return;
    }
    const next = [...tags, value];
    setTags(next);
    setTagDraft("");
    setTagOpen(false);
    void updateChatLeadTags({ leadId: lead.id, tags: next }).catch(() => null);
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    void updateChatLeadTags({ leadId: lead.id, tags: next }).catch(() => null);
  }

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

      <div className="mt-2 flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
        <StarRating value={stars} onChange={changeStars} size="sm" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1 text-[10px]">
            {tag}
            <button type="button" onClick={() => removeTag(tag)}>
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {tagOpen ? (
          <Input
            autoFocus
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
              if (e.key === "Escape") {
                setTagOpen(false);
                setTagDraft("");
              }
            }}
            onBlur={addTag}
            placeholder="Nova tag"
            className="h-6 w-20 px-1.5 text-[10px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTagOpen(true);
              setTagDraft("");
            }}
            className="rounded-full border border-dashed border-border/70 p-0.5 text-muted-foreground hover:border-brand hover:text-brand"
            title="Adicionar tag"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-[11px]">
        {lead.source ? (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{lead.source}</span>
        ) : <span />}
        <span className="font-mono font-semibold" style={{ color: stageColor }}>
          {formatCurrencyBRL(lead.value_cents)}
        </span>
      </div>

      {lead.phone && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-2.5" onPointerDown={(e) => e.stopPropagation()}>
          <CallButton leadId={lead.id} phone={lead.phone} iconOnly />
          <WhatsAppCallButton phone={lead.phone} iconOnly />
        </div>
      )}
    </div>
  );
}
