"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search, Inbox, UsersRound, Plus, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, initials } from "@/lib/utils";
import type { ConversationListItem, ConversationStatus, WhatsAppGroupListItem } from "@/lib/chat/types";
import { CONVERSATION_STATUSES, STATUS_META } from "@/lib/chat/status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addGroupLabel, removeGroupLabel } from "./actions";

export type { ConversationListItem };

type Tab = "contatos" | "grupos";
type StatusFilter = ConversationStatus | "todas";
type GroupDateFilter = "today" | "7d" | "30d" | "all";

const groupDateFilters: { value: GroupDateFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Tudo" },
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function groupDateCutoff(filter: GroupDateFilter): Date | null {
  if (filter === "all") return null;
  if (filter === "today") return startOfToday();

  const date = new Date();
  date.setDate(date.getDate() - (filter === "7d" ? 7 : 30));
  return date;
}

export function ConversationList({
  items,
  groups,
}: {
  items: ConversationListItem[];
  groups: WhatsAppGroupListItem[];
}) {
  const pathname = usePathname();
  const activeLeadId = pathname.startsWith("/chat/") ? (pathname.split("/")[2] ?? null) : null;
  const activeGroupId = pathname.startsWith("/chat/groups/") ? (pathname.split("/")[3] ?? null) : null;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("contatos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [groupDateFilter, setGroupDateFilter] = useState<GroupDateFilter>("all");

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (statusFilter !== "todas" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.leadName.toLowerCase().includes(q) ||
        c.leadSubtitle.toLowerCase().includes(q) ||
        c.leadPhone.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      );
    });
  }, [items, query, statusFilter]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = groupDateCutoff(groupDateFilter);
    return groups.filter((group) => {
      const matchesQuery =
        !q ||
        group.subject.toLowerCase().includes(q) ||
        group.providerGroupId.toLowerCase().includes(q) ||
        group.labels.some((label) => label.name.toLowerCase().includes(q));

      if (!matchesQuery) return false;
      if (!cutoff) return true;
      if (!group.lastAt) return false;

      const groupDate = new Date(group.lastAt);
      return Number.isFinite(groupDate.getTime()) && groupDate >= cutoff;
    });
  }, [groups, groupDateFilter, query]);

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-card dark:border-border/50 dark:bg-card/62">
      <header className="border-b border-border/50 px-4 py-4">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-normal">Conversas</h2>
        <div className="mb-3 grid grid-cols-2 rounded-lg border border-border/60 bg-muted/20 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("contatos")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              tab === "contatos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Contatos <span className="ml-1 tabular-nums text-muted-foreground">{items.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("grupos")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              tab === "grupos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Grupos <span className="ml-1 tabular-nums text-muted-foreground">{groups.length}</span>
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tab === "grupos" ? "Pesquisar grupo ou label..." : "Pesquisar conversa..."}
            className="h-10 rounded-lg border-border/60 bg-background/50 pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {tab === "grupos" && (
          <div className="mt-3 grid grid-cols-4 rounded-lg border border-border/60 bg-muted/20 p-1 text-xs">
            {groupDateFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setGroupDateFilter(filter.value)}
                className={cn(
                  "rounded-md px-2 py-1.5 font-medium transition-colors",
                  groupDateFilter === filter.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {tab === "contatos" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusPill
              active={statusFilter === "todas"}
              onClick={() => setStatusFilter("todas")}
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
                  onClick={() => setStatusFilter(active ? "todas" : s.value)}
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
        {tab === "grupos" ? (
          <GroupList groups={filteredGroups} activeGroupId={activeGroupId} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenhuma conversa</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              As mensagens do WhatsApp aparecem aqui automaticamente.
            </p>
          </div>
        ) : filtered.map((c) => {
          const active = activeLeadId === c.leadId;
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
              prefetch
              className={cn(
                "relative flex gap-3 border-b border-border/35 py-3 pl-4 pr-3 transition-colors duration-150 hover:bg-brand/10 dark:hover:bg-brand/15",
                active && "bg-brand-muted dark:bg-brand/10",
              )}
            >
              {/* Faixa de status na borda esquerda */}
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-1",
                  active ? "bg-brand" : STATUS_META[c.status].dot,
                )}
                aria-hidden
              />
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
    </aside>
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

function GroupList({ groups, activeGroupId }: { groups: WhatsAppGroupListItem[]; activeGroupId: string | null }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <UsersRound className="mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm font-medium">Nenhum grupo</p>
        <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
          Ajuste o filtro de data ou aguarde novas mensagens da Evolution.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/35">
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} active={activeGroupId === group.id} />
      ))}
    </div>
  );
}

function GroupRow({ group, active }: { group: WhatsAppGroupListItem; active: boolean }) {
  const [labelName, setLabelName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [pending, start] = useTransition();

  function submitLabel(e: React.FormEvent) {
    e.preventDefault();
    const name = labelName.trim();
    if (!name) return;
    start(async () => {
      try {
        await addGroupLabel({ groupId: group.id, name });
        setLabelName("");
        setExpanded(false);
      } catch (err) {
        alert((err as Error).message);
      }
    });
  }

  function onRemove(labelId: string) {
    start(async () => {
      try {
        await removeGroupLabel({ groupId: group.id, labelId });
      } catch (err) {
        alert((err as Error).message);
      }
    });
  }

  const preview = group.lastPreview
    ? group.lastDirection === "outbound"
      ? `Voce: ${group.lastPreview}`
      : group.lastPreview
    : group.participantCount === null
      ? "Sem mensagens recentes"
      : `Sem mensagens recentes - ${group.participantCount} participantes`;

  return (
    <div
      className={cn(
        "px-3 py-3 transition-colors hover:bg-brand/10 dark:hover:bg-brand/15",
        active && "border-l-2 border-l-brand bg-brand-muted dark:bg-brand/10",
      )}
    >
      <div className="flex gap-3">
        <Link href={`/chat/groups/${group.id}`} className="shrink-0" prefetch>
          <Avatar className="h-11 w-11">
            <AvatarFallback className="bg-info/10 text-info">
              <UsersRound className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <Link href={`/chat/groups/${group.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-brand" prefetch>
              {group.subject}
            </Link>
            {group.lastAt && (
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDistanceToNow(new Date(group.lastAt), { locale: ptBR, addSuffix: false })}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {preview}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium"
                style={{ borderColor: `${label.color}55`, color: label.color }}
              >
                {label.name}
                <button
                  type="button"
                  onClick={() => onRemove(label.id)}
                  className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                  disabled={pending}
                  aria-label={`Remover label ${label.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              Label
            </button>
          </div>
          {expanded && (
            <form onSubmit={submitLabel} className="mt-2 flex gap-2">
              <Input
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                placeholder="Nova label"
                className="h-8 rounded-md text-xs"
                maxLength={32}
              />
              <Button type="submit" size="sm" className="h-8 rounded-md px-3" disabled={pending || !labelName.trim()}>
                Salvar
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
