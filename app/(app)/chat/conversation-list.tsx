"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Search, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, initials } from "@/lib/utils";
import type { ConversationListItem, ConversationStatus } from "@/lib/chat/types";
import { CONVERSATION_STATUSES, STATUS_META } from "@/lib/chat/status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

export type { ConversationListItem };

export type StatusFilter = ConversationStatus | "todas";

export function ConversationList({
  items,
  query,
  statusFilter,
  onQueryChange,
  onStatusFilterChange,
}: {
  items: ConversationListItem[];
  query: string;
  statusFilter: StatusFilter;
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
}) {
  const pathname = usePathname();
  const activeLeadId = pathname.startsWith("/chat/") ? (pathname.split("/")[2] ?? null) : null;

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

  return (
    <aside
      className={cn(
        "w-full shrink-0 flex-col border-r border-border bg-card dark:border-border/50 dark:bg-card/62 md:flex md:w-[360px]",
        activeLeadId ? "hidden" : "flex",
      )}
    >
      <header className="border-b border-border/50 px-4 py-4">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-normal">Conversas</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar conversa..."
            className="h-10 rounded-lg border-border/60 bg-background/50 pl-9"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

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
