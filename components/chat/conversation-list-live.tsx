"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchConversationItems } from "@/lib/chat/client";
import type { ConversationListItem } from "@/lib/chat/types";
import { ConversationList, type StatusFilter } from "@/app/(app)/chat/conversation-list";

/** Fallback se realtime falhar. */
// Realtime ja atualiza a lista; polling e rede de seguranca, lento e so visivel.
const CONTACT_POLL_MS = 30_000;

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contactRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

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

  const refreshContacts = useCallback(async () => {
    try {
      const next = await fetchConversationItems(tenantId, {
        query,
        status: statusFilter === "todas" ? undefined : statusFilter,
      });
      setItems(next);
    } catch {
      /* mantem lista anterior */
    }
  }, [query, statusFilter, tenantId]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshContacts();
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

  const scheduleContactsRefresh = useCallback(() => {
    if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
    contactRefreshTimerRef.current = setTimeout(() => void refreshContacts(), 450);
  }, [refreshContacts]);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const timer = setTimeout(() => void refreshContacts(), 280);
    return () => clearTimeout(timer);
  }, [query, refreshContacts]);

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
      if (document.visibilityState === "visible") void refreshContacts();
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
          const row = payload.new as { direction?: string } | null;
          if (row?.direction === "inbound") playNotificationSound();
          scheduleContactsRefresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => scheduleContactsRefresh(),
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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") scheduleContactsRefresh();
      });

    return () => {
      if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, scheduleContactsRefresh, playNotificationSound]);

  return (
    <ConversationList
      items={items}
      query={query}
      statusFilter={statusFilter}
      onQueryChange={setQuery}
      onStatusFilterChange={setStatusFilter}
      onRefresh={handleManualRefresh}
      isRefreshing={isRefreshing}
      instances={instances}
      stages={stages}
    />
  );
}
