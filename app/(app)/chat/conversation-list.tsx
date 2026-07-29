"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Inbox,
  Phone,
  RefreshCw,
  SlidersHorizontal,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, initials } from "@/lib/utils";
import type { ConversationListItem, ConversationStatus } from "@/lib/chat/types";
import { CONVERSATION_STATUSES, STATUS_META } from "@/lib/chat/status";
import { getSharedStageFilter, setSharedStageFilter } from "@/lib/chat/shared-stage-filter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify, notifyError } from "@/lib/ui/feedback";
import { moveLeadsToStage } from "@/app/(app)/leads/actions";

export type { ConversationListItem };

export type StatusFilter = ConversationStatus | "todas";

const ATTENDANCE_WINDOW_HOURS = 24;

type AttendanceWindowFilter = "todos" | "dentro" | "expirada";
type LastMessagePeriodFilter = "todos" | "hoje" | "7dias" | "30dias";
type OrderFilter = "recentes" | "antigas";
type ArrivedFilter = "todos" | "hoje" | "ontem" | "personalizado";

type AdvancedFilters = {
  instanceId: string;
  tag: string;
  stageId: string;
  attendanceWindow: AttendanceWindowFilter;
  lastMessagePeriod: LastMessagePeriodFilter;
  order: OrderFilter;
  arrived: ArrivedFilter;
  arrivedDate: string;
  minStars: number;
};

const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  instanceId: "todos",
  tag: "todos",
  stageId: "todos",
  attendanceWindow: "todos",
  lastMessagePeriod: "todos",
  order: "recentes",
  arrived: "todos",
  arrivedDate: "",
  minStars: 0,
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

function isWithinAttendanceWindow(lastAt: string | null): boolean {
  if (!lastAt) return false;
  const hours = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60);
  return hours <= ATTENDANCE_WINDOW_HOURS;
}

function isWithinPeriod(lastAt: string | null, period: LastMessagePeriodFilter): boolean {
  if (period === "todos") return true;
  if (!lastAt) return false;
  const days = (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24);
  if (period === "hoje") return days <= 1;
  if (period === "7dias") return days <= 7;
  return days <= 30;
}

export function ConversationList({
  items,
  query,
  statusFilter,
  onQueryChange,
  onStatusFilterChange,
  onRefresh,
  isRefreshing,
  instances,
  stages,
  tenantId,
}: {
  items: ConversationListItem[];
  query: string;
  statusFilter: StatusFilter;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  instances: { id: string; label: string }[];
  stages: { id: string; name: string }[];
  tenantId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeLeadId = pathname.startsWith("/chat/") ? (pathname.split("/")[2] ?? null) : null;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);

  // Selecao em massa: mover varios leads de uma vez pra uma etapa, sem abrir
  // cada conversa. Mesmo padrao do Kanban (moveLeadsToStage), so que
  // disparado a partir da lista de conversas.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStageId, setBulkStageId] = useState("");
  const [bulkMoving, setBulkMoving] = useState(false);

  function toggleSelectMode() {
    setSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }

  function toggleLeadSelected(leadId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  async function applyBulkMove() {
    if (!bulkStageId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setBulkMoving(true);
    try {
      await moveLeadsToStage(ids, bulkStageId);
      notify({
        title: `${ids.length} conversa${ids.length === 1 ? "" : "s"} movida${ids.length === 1 ? "" : "s"}`,
        tone: "success",
      });
      setSelectedIds(new Set());
      setBulkStageId("");
      setSelectMode(false);
      router.refresh();
    } catch (err) {
      notifyError(err, "Não foi possível mover as conversas selecionadas");
    } finally {
      setBulkMoving(false);
    }
  }

  // Sincroniza o filtro de etapa com o Kanban: se ja tem uma etapa filtrada
  // la (ou aqui mesmo numa sessao anterior), comeca com ela aplicada.
  useEffect(() => {
    if (!tenantId) return;
    const sharedStageId = getSharedStageFilter(tenantId);
    if (sharedStageId) {
      setAppliedFilters((prev) => ({ ...prev, stageId: sharedStageId }));
    }
  }, [tenantId]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of items) for (const tag of c.tags) set.add(tag);
    return [...set].sort();
  }, [items]);

  const statusCounts = useMemo(() => {
    const counts: Record<ConversationStatus, number> = {
      nao_iniciada: 0,
      aguardando: 0,
      em_atendimento: 0,
      resolvida: 0,
    };
    for (const c of items) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [items]);

  const activeAdvancedCount = Object.entries(appliedFilters).filter(
    ([key, value]) => value !== DEFAULT_ADVANCED_FILTERS[key as keyof AdvancedFilters],
  ).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = items.filter((c) => {
      if (statusFilter !== "todas" && c.status !== statusFilter) return false;
      if (appliedFilters.instanceId !== "todos" && c.whatsappAccountId !== appliedFilters.instanceId) return false;
      if (appliedFilters.tag !== "todos" && !c.tags.includes(appliedFilters.tag)) return false;
      if (appliedFilters.stageId !== "todos" && c.stageId !== appliedFilters.stageId) return false;
      if (appliedFilters.attendanceWindow !== "todos") {
        const within = isWithinAttendanceWindow(c.lastAt);
        if (appliedFilters.attendanceWindow === "dentro" && !within) return false;
        if (appliedFilters.attendanceWindow === "expirada" && within) return false;
      }
      if (!isWithinPeriod(c.lastAt, appliedFilters.lastMessagePeriod)) return false;
      if (!matchesArrivedFilter(c.leadCreatedAt, appliedFilters.arrived, appliedFilters.arrivedDate)) return false;
      if (appliedFilters.minStars > 0 && c.qualityStars < appliedFilters.minStars) return false;
      if (!q) return true;
      return (
        c.leadName.toLowerCase().includes(q) ||
        c.leadSubtitle.toLowerCase().includes(q) ||
        c.leadPhone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });

    result.sort((a, b) => {
      const aAt = a.lastAt ? Date.parse(a.lastAt) : 0;
      const bAt = b.lastAt ? Date.parse(b.lastAt) : 0;
      return appliedFilters.order === "recentes" ? bAt - aAt : aAt - bAt;
    });

    return result;
  }, [items, query, statusFilter, appliedFilters]);

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFiltersOpen(true);
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    if (tenantId) setSharedStageFilter(tenantId, draftFilters.stageId);
    setFiltersOpen(false);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_ADVANCED_FILTERS);
    setAppliedFilters(DEFAULT_ADVANCED_FILTERS);
    if (tenantId) setSharedStageFilter(tenantId, null);
    setFiltersOpen(false);
  }

  return (
    <aside
      className={cn(
        "w-full shrink-0 flex-col border-r border-border bg-[hsl(var(--chat-surface))] dark:border-border/50 md:flex md:w-[360px]",
        activeLeadId ? "hidden" : "flex",
      )}
    >
      <header className="border-b border-border/50 px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-normal">Conversas</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSelectMode}
              title="Selecionar várias conversas"
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors",
                selectMode
                  ? "bg-brand/15 text-brand"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {selectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={openFilters}
              title="Filtros"
              className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeAdvancedCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-brand-foreground">
                  {activeAdvancedCount}
                </span>
              )}
            </button>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Atualizar conversas"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conversa..."
            className="h-10 rounded-lg border-border/60 bg-background/50 pl-9"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

        {selectMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 p-2.5">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selecionada${selectedIds.size === 1 ? "" : "s"}`
                : "Toque nas conversas pra selecionar"}
            </span>
            <select
              value={bulkStageId}
              onChange={(e) => setBulkStageId(e.target.value)}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              disabled={selectedIds.size === 0 || bulkMoving}
            >
              <option value="">Mover para etapa...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="h-8"
              onClick={applyBulkMove}
              disabled={!bulkStageId || bulkMoving || selectedIds.size === 0}
            >
              {bulkMoving ? "Movendo..." : "Mover"}
            </Button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkMoving}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusPill
              active={statusFilter === "todas"}
              onClick={() => onStatusFilterChange("todas")}
              label="Todas"
              count={items.length}
            />
            {CONVERSATION_STATUSES.map((s) => {
              const Icon = s.icon;
              const active = statusFilter === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onStatusFilterChange(active ? "todas" : s.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? s.pill
                      : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.short}
                  <span className="tabular-nums opacity-70">{statusCounts[s.value]}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenhuma conversa</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              As mensagens do WhatsApp aparecem aqui automaticamente.
            </p>
          </div>
        ) : filtered.map((c) => {
          const active = activeLeadId === c.leadId;
          const selected = selectedIds.has(c.leadId);
          const preview =
            c.lastPreview != null
              ? c.lastDirection === "outbound"
                ? `Voce: ${c.lastPreview}`
                : c.lastPreview
              : "";

          return (
            <Link
              key={c.id}
              href={`/chat/${c.leadId}`}
              prefetch={!selectMode}
              onClick={(e) => {
                // Em modo selecao o clique marca/desmarca em vez de navegar -
                // o mesmo comportamento do card no Kanban.
                if (!selectMode) return;
                e.preventDefault();
                toggleLeadSelected(c.leadId);
              }}
              className={cn(
                "relative flex gap-3 border-b border-border/35 py-3 pl-4 pr-3 transition-colors duration-150 hover:bg-brand/10 dark:hover:bg-brand/15",
                active && !selectMode && "bg-brand-muted dark:bg-brand/10",
                selected && "bg-brand/10 dark:bg-brand/15",
              )}
            >
              {/* Faixa de status na borda esquerda */}
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-1",
                  active && !selectMode ? "bg-brand" : STATUS_META[c.status].dot,
                )}
                aria-hidden
              />
              {selectMode && (
                <span className="flex shrink-0 items-center" aria-hidden>
                  {selected ? (
                    <CheckSquare className="h-4 w-4 text-brand" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              )}
              <div className="relative shrink-0">
                <Avatar className="h-11 w-11">
                  {c.leadAvatarUrl && <AvatarImage src={c.leadAvatarUrl} alt={c.leadName} />}
                  <AvatarFallback className="bg-brand-muted text-sm font-semibold text-brand dark:bg-brand dark:text-brand-foreground">
                    {initials(c.leadName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                    STATUS_META[c.status].dot,
                  )}
                  title={STATUS_META[c.status].label}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>
                    {c.leadName}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.callCount != null && <CallAttemptMarker count={c.callCount} />}
                    {c.lastAt && (
                      <span
                        className={cn(
                          "shrink-0 text-[11px]",
                          c.unread > 0 ? "font-medium text-brand" : "text-muted-foreground",
                        )}
                      >
                        {formatDistanceToNow(new Date(c.lastAt), { locale: ptBR, addSuffix: false })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-xs text-muted-foreground",
                      c.unread > 0 && "font-medium text-foreground",
                    )}
                  >
                    {preview || c.leadSubtitle}
                  </p>
                  {c.unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

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
              <FilterField label="Instancias">
                <Select
                  value={draftFilters.instanceId}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, instanceId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Tags">
                <Select value={draftFilters.tag} onValueChange={(v) => setDraftFilters((f) => ({ ...f, tag: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {availableTags.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Negocio na etapa">
                <Select
                  value={draftFilters.stageId}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, stageId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Nenhum selecionado</SelectItem>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Qualidade mínima">
                <Select
                  value={String(draftFilters.minStars)}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, minStars: Number(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Qualquer</SelectItem>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {"★".repeat(n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Janela em atendimento">
                <Select
                  value={draftFilters.attendanceWindow}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, attendanceWindow: v as AttendanceWindowFilter }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="dentro">Dentro da janela (24h)</SelectItem>
                    <SelectItem value="expirada">Expirada</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Data da ultima mensagem">
                <Select
                  value={draftFilters.lastMessagePeriod}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, lastMessagePeriod: v as LastMessagePeriodFilter }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Nenhuma data selecionada</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="7dias">Ultimos 7 dias</SelectItem>
                    <SelectItem value="30dias">Ultimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Lead chegou">
                <Select
                  value={draftFilters.arrived}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, arrived: v as ArrivedFilter }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Qualquer data</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="ontem">Ontem</SelectItem>
                    <SelectItem value="personalizado">Data personalizada</SelectItem>
                  </SelectContent>
                </Select>
                {draftFilters.arrived === "personalizado" && (
                  <Input
                    type="date"
                    className="mt-2"
                    value={draftFilters.arrivedDate}
                    onChange={(e) => setDraftFilters((f) => ({ ...f, arrivedDate: e.target.value }))}
                  />
                )}
              </FilterField>

              <FilterField label="Ordem">
                <Select
                  value={draftFilters.order}
                  onValueChange={(v) => setDraftFilters((f) => ({ ...f, order: v as OrderFilter }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recentes">Mais recentes</SelectItem>
                    <SelectItem value="antigas">Mais antigas</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 px-4 py-4">
              <Button variant="outline" className="flex-1" onClick={clearFilters}>
                Limpar filtros
              </Button>
              <Button className="flex-1" onClick={applyFilters}>
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function StatusPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand/40 bg-brand/15 text-brand"
          : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function CallAttemptMarker({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <span
        title="Nenhuma ligação feita"
        aria-label="Nenhuma ligação feita"
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 ring-2 ring-background"
      />
    );
  }

  return (
    <span
      title={`${count} tentativa${count === 1 ? "" : "s"} de ligação`}
      aria-label={`${count} tentativa${count === 1 ? "" : "s"} de ligação`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-300"
    >
      <Phone className="h-2.5 w-2.5" />
      {count}
    </span>
  );
}
