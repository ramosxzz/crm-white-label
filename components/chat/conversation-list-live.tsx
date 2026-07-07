"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchConversationItems } from "@/lib/chat/client";
import type { ConversationListItem } from "@/lib/chat/types";
import { ConversationList, type StatusFilter } from "@/app/(app)/chat/conversation-list";

/** Fallback se realtime falhar. */
const CONTACT_POLL_MS = 12_000;

export function ConversationListLive({
  tenantId,
  initialItems,
}: {
  tenantId: string;
  initialItems: ConversationListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const contactRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshContacts = useCallback(async () => {
    try {
      const next = await fetchConversationItems(tenantId, { query });
      setItems(next);
    } catch {
      /* mantem lista anterior */
    }
  }, [query, tenantId]);

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
    contactRefreshTimerRef.current = setTimeout(() => void refreshContacts(), 1200);
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
    const contactTimer = setInterval(() => void refreshContacts(), CONTACT_POLL_MS);
    return () => {
      clearInterval(contactTimer);
    };
  }, [refreshContacts]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversations-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
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
      .subscribe();

    return () => {
      if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, scheduleContactsRefresh]);

  return (
    <ConversationList
      items={items}
      query={query}
      statusFilter={statusFilter}
      onQueryChange={setQuery}
      onStatusFilterChange={setStatusFilter}
    />
  );
}
