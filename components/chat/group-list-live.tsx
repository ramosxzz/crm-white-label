"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, UsersRound, Tags } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWhatsAppGroupItems } from "@/lib/chat/client";
import type { WhatsAppGroupListItem } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type GroupLabel = { id: string; name: string; color: string };

export function GroupListLive({
  tenantId,
  initialItems,
  allLabels = [],
}: {
  tenantId: string;
  initialItems: WhatsAppGroupListItem[];
  allLabels?: GroupLabel[];
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) next.delete(labelId);
      else next.add(labelId);
      return next;
    });
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchWhatsAppGroupItems(tenantId));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void refresh(), 300);
  }, [refresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`whatsapp-groups-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_groups", filter: `tenant_id=eq.${tenantId}` },
        scheduleRefresh,
      )
      .subscribe();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 90_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [refresh, scheduleRefresh, tenantId]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesTerm =
        !term ||
        [item.subject, item.description, item.providerGroupId]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("pt-BR").includes(term));
      const matchesLabels =
        selectedLabelIds.size === 0 || item.labels.some((label) => selectedLabelIds.has(label.id));
      return matchesTerm && matchesLabels;
    });
  }, [items, query, selectedLabelIds]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-5 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold">Grupos do WhatsApp</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "grupo sincronizado" : "grupos sincronizados"}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void refresh()} disabled={loading} title="Atualizar grupos">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      <div className="shrink-0 space-y-3 border-b border-border/40 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar grupo..."
            className="pl-9"
          />
        </div>
        {allLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tags className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {allLabels.map((label) => {
              const active = selectedLabelIds.has(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    active ? "text-white" : "text-muted-foreground hover:opacity-80",
                  )}
                  style={
                    active
                      ? { backgroundColor: label.color, borderColor: label.color }
                      : { borderColor: `${label.color}55`, color: label.color }
                  }
                >
                  {label.name}
                </button>
              );
            })}
            {selectedLabelIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedLabelIds(new Set())}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        {filtered.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border/70 text-center">
            <div className="max-w-sm px-6">
              <UsersRound className="mx-auto h-9 w-9 text-muted-foreground" />
              <p className="mt-3 font-medium">{query ? "Nenhum grupo encontrado" : "Nenhum grupo sincronizado"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Os grupos aparecem automaticamente quando a conta Evolution envia um evento ou uma mensagem.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-2">
            {filtered.map((item) => (
              <Link
                key={item.id}
                href={`/chat/groups/${item.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-border/55 bg-card/75 p-3.5 transition-colors hover:border-brand/35 hover:bg-brand/5"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{item.subject}</p>
                    {item.participantCount !== null && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{item.participantCount} participantes</span>
                    )}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {item.lastDirection === "outbound" && <span className="shrink-0 text-brand">Você:</span>}
                    <span className="truncate">{item.lastPreview ?? item.description ?? "Sem mensagens"}</span>
                  </div>
                  {item.labels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.labels.map((label) => (
                        <Badge key={label.id} variant="outline" className="text-[10px]" style={{ borderColor: `${label.color}55`, color: label.color }}>
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {item.lastAt
                      ? formatDistanceToNow(new Date(item.lastAt), { addSuffix: true, locale: ptBR })
                      : ""}
                  </span>
                  {item.unreadCount > 0 && (
                    <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-brand-foreground">
                      {item.unreadCount > 99 ? "99+" : item.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
