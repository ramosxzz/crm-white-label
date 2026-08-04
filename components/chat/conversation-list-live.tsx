"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchConversationItems } from "@/lib/chat/client";
import type { ConversationListItem } from "@/lib/chat/types";
import {
  applyRealtimeMessageToConversationItems,
  type RealtimeConversationMessage,
} from "@/lib/chat/realtime-conversation-update";
import { ConversationList, type StatusFilter } from "@/app/(app)/chat/conversation-list";

/** Fallback se realtime falhar. */
// Realtime ja atualiza a lista; polling e rede de seguranca, lento e so visivel.
const CONTACT_POLL_MS = 90_000;
const CONTACT_REALTIME_REFRESH_MS = 400;
const CONTACT_REFRESH_MIN_INTERVAL_MS = 3_000;
const CONTACT_ACTIVE_REFRESH_COOLDOWN_MS = 15_000;
const SEARCH_DEBOUNCE_MS = 250;
// Rede de seguranca: se a Evolution nunca mandar o presence "parou" (paused/
// available), o indicador nao pode ficar preso pra sempre.
const PRESENCE_EXPIRE_MS = 8_000;

export function ConversationListLive({
  tenantId,
  initialItems,
  instances,
  stages,
}: {
  tenantId: string;
  initialItems: ConversationListItem[];
  instances: { id: string; label: string }[];
  stages: { id: string; name: string }[];
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [searchItems, setSearchItems] = useState<ConversationListItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contactRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactRefreshInFlightRef = useRef(false);
  const contactRefreshPendingRef = useRef(false);
  const refreshContactsRef = useRef<(options?: { force?: boolean }) => Promise<void>>(async () => {});
  const lastContactRefreshAtRef = useRef(0);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const presenceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // A assinatura de realtime abaixo so filtra por tenant_id: o Postgres Changes
  // nao enxerga a regra de "quem pode ver qual conversa" (numero atribuido a
  // outro vendedor, numero exclusivo do administrador etc). Sem este ref, o
  // som tocava pra QUALQUER mensagem do tenant inteiro - inclusive as que a
  // pessoa nunca veria na lista. `items` ja vem filtrado pelo mesmo
  // getChatAccountVisibility usado no servidor; o ref existe so porque o
  // efeito do realtime nao pode depender de `items` sem recriar o canal a
  // cada atualizacao da lista.
  const visibleConversationIdsRef = useRef<Set<string>>(new Set(initialItems.map((item) => item.id)));

  useEffect(() => {
    visibleConversationIdsRef.current = new Set(
      [...items, ...(searchItems ?? [])].map((item) => item.id),
    );
  }, [items, searchItems]);

  const setPresence = useCallback((conversationId: string, state: "composing" | "recording" | null) => {
    const timers = presenceTimersRef.current;
    const existingTimer = timers.get(conversationId);
    if (existingTimer) clearTimeout(existingTimer);
    timers.delete(conversationId);

    setItems((current) =>
      current.map((item) => (item.id === conversationId ? { ...item, presence: state } : item)),
    );
    setSearchItems((current) =>
      current?.map((item) =>
        item.id === conversationId ? { ...item, presence: state } : item,
      ) ?? null,
    );

    if (state) {
      const timer = setTimeout(() => {
        timers.delete(conversationId);
        setItems((current) =>
          current.map((item) => (item.id === conversationId ? { ...item, presence: null } : item)),
        );
        setSearchItems((current) =>
          current?.map((item) =>
            item.id === conversationId ? { ...item, presence: null } : item,
          ) ?? null,
        );
      }, PRESENCE_EXPIRE_MS);
      timers.set(conversationId, timer);
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("chat_notification_sound") === "off") return;
    if (!notificationAudioRef.current) {
      notificationAudioRef.current = new Audio("/sounds/notification.mp3");
    }
    const audio = notificationAudioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => null);
  }, []);

  const refreshContacts = useCallback(async (options: { force?: boolean } = {}) => {
    const now = Date.now();
    if (contactRefreshInFlightRef.current) {
      contactRefreshPendingRef.current = true;
      return;
    }

    const remainingCooldown = CONTACT_REFRESH_MIN_INTERVAL_MS - (now - lastContactRefreshAtRef.current);
    if (!options.force && remainingCooldown > 0) {
      contactRefreshPendingRef.current = true;
      if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
      contactRefreshTimerRef.current = setTimeout(() => {
        contactRefreshTimerRef.current = null;
        contactRefreshPendingRef.current = false;
        void refreshContactsRef.current();
      }, remainingCooldown);
      return;
    }

    contactRefreshInFlightRef.current = true;
    contactRefreshPendingRef.current = false;
    try {
      // A lista em estado precisa ser sempre a base completa. Pesquisa e
      // status sao aplicados localmente por ConversationList; substituir a
      // base por uma resposta filtrada fazia os contadores mudarem de coluna.
      const next = await fetchConversationItems(tenantId);
      setItems(next);
    } catch {
      /* mantem lista anterior */
    } finally {
      lastContactRefreshAtRef.current = Date.now();
      contactRefreshInFlightRef.current = false;
      if (contactRefreshPendingRef.current) {
        if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
        contactRefreshTimerRef.current = setTimeout(() => {
          contactRefreshTimerRef.current = null;
          contactRefreshPendingRef.current = false;
          void refreshContactsRef.current();
        }, CONTACT_REFRESH_MIN_INTERVAL_MS);
      }
    }
  }, [tenantId]);

  refreshContactsRef.current = refreshContacts;

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshContacts({ force: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshContacts]);

  const syncMissingProfilePictures = useCallback(async (currentItems: ConversationListItem[]) => {
    const leadIds = currentItems
      .filter((item) => item.leadPhone && !item.leadAvatarUrl)
      .slice(0, 20)
      .map((item) => item.leadId);
    if (leadIds.length === 0) return;

    try {
      const res = await fetch("/api/chat/profile-pictures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });
      const data = (await res.json()) as { avatars?: Record<string, string | null> };
      const avatars = data.avatars ?? {};
      if (Object.keys(avatars).length === 0) return;

      setItems((prev) =>
        prev.map((item) =>
          item.leadAvatarUrl || !avatars[item.leadId]
            ? item
            : { ...item, leadAvatarUrl: avatars[item.leadId] },
        ),
      );
    } catch {
      /* fallback visual continua com iniciais */
    }
  }, []);

  const scheduleContactsRefresh = useCallback((delayMs = CONTACT_REALTIME_REFRESH_MS) => {
    if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
    contactRefreshPendingRef.current = true;
    contactRefreshTimerRef.current = setTimeout(() => {
      contactRefreshTimerRef.current = null;
      contactRefreshPendingRef.current = false;
      void refreshContactsRef.current();
    }, delayMs);
  }, []);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // A lista normal traz so as conversas mais recentes para manter o chat
  // leve. Ao pesquisar, consulta o servidor para encontrar tambem contatos
  // antigos, sempre com a mesma regra de tenant/numero do usuario logado.
  useEffect(() => {
    const search = query.trim();
    if (!search) {
      setSearchItems(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(() => {
      void fetchConversationItems(tenantId, { query: search, signal: controller.signal })
        .then(setSearchItems)
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            // Mantem o filtro local como contingencia se a rede oscilar.
            setSearchItems(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tenantId]);

  useEffect(() => {
    const timer = setTimeout(() => void syncMissingProfilePictures(items), 600);
    return () => clearTimeout(timer);
  }, [items, syncMissingProfilePictures]);

  useEffect(() => {
    const contactTimer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshContacts();
    }, CONTACT_POLL_MS);
    return () => {
      clearInterval(contactTimer);
    };
  }, [refreshContacts]);

  useEffect(() => {
    const refreshIfActive = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastContactRefreshAtRef.current < CONTACT_ACTIVE_REFRESH_COOLDOWN_MS) return;
      void refreshContacts();
    };

    window.addEventListener("focus", refreshIfActive);
    window.addEventListener("online", refreshIfActive);
    document.addEventListener("visibilitychange", refreshIfActive);
    return () => {
      window.removeEventListener("focus", refreshIfActive);
      window.removeEventListener("online", refreshIfActive);
      document.removeEventListener("visibilitychange", refreshIfActive);
    };
  }, [refreshContacts]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversations-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeConversationMessage | null;
          const isVisibleConversation = Boolean(
            row?.conversation_id && visibleConversationIdsRef.current.has(row.conversation_id),
          );
          if (row) {
            setItems((current) => applyRealtimeMessageToConversationItems(current, row).items);
            setSearchItems((current) =>
              current ? applyRealtimeMessageToConversationItems(current, row).items : null,
            );
          }
          // So toca se a conversa e uma que esta na lista desta pessoa agora.
          // Conversa nova (ainda nao refletida no estado) fica sem som ate o
          // proximo refresh - troca aceitavel por nunca mais tocar pra
          // mensagem que a pessoa nem pode ver.
          if (
            row?.direction === "inbound" &&
            isVisibleConversation
          ) {
            // O card e o contador entram primeiro no próximo frame; o som vem
            // depois, acompanhando o que a pessoa já consegue ver na tela.
            requestAnimationFrame(playNotificationSound);
          }
          // Para conversa existente o payload já atualizou a tela. A espera
          // maior evita uma consulta precoce sobrescrever o estado otimista
          // antes de `conversations` terminar de atualizar. Conversas novas
          // ainda precisam da consulta rápida para obter lead e permissões.
          scheduleContactsRefresh(
            isVisibleConversation ? CONTACT_REFRESH_MIN_INTERVAL_MS : CONTACT_REALTIME_REFRESH_MS,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => scheduleContactsRefresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leads",
          filter: `tenant_id=eq.${tenantId}`,
        },
        // Mudar a etapa/tags/estrelas do negocio dentro do chat atualiza a
        // tabela leads, nao conversations - sem isso a lista da esquerda
        // (e os filtros por etapa) so refletiam apos o poll de 90s.
        () => scheduleContactsRefresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_presence",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { conversation_id?: string } | null;
            if (oldRow?.conversation_id) setPresence(oldRow.conversation_id, null);
            return;
          }
          const row = payload.new as { conversation_id?: string; state?: "composing" | "recording" } | null;
          if (row?.conversation_id) setPresence(row.conversation_id, row.state ?? null);
        },
      )
      .subscribe();

    return () => {
      if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
      for (const timer of presenceTimersRef.current.values()) clearTimeout(timer);
      presenceTimersRef.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [tenantId, scheduleContactsRefresh, playNotificationSound, setPresence]);

  return (
    <ConversationList
      items={items}
      searchItems={searchItems}
      query={query}
      statusFilter={statusFilter}
      onQueryChange={setQuery}
      onStatusFilterChange={setStatusFilter}
      onRefresh={handleManualRefresh}
      isRefreshing={isRefreshing}
      isSearching={isSearching}
      instances={instances}
      stages={stages}
      tenantId={tenantId}
    />
  );
}
