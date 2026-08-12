"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, UsersRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWhatsAppGroupItems } from "@/lib/chat/client";
import type { WhatsAppGroupListItem } from "@/lib/chat/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function GroupListLive({
  tenantId,
  initialItems,
}: {
  tenantId: string;
  initialItems: WhatsAppGroupListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (!term) return items;
    return items.filter((item) =>
      [item.subject, item.description, item.providerGroupId]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [items, query]);

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

      <div className="shrink-0 border-b border-border/40 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar grupo..."
            className="pl-9"
          />
        </div>
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
