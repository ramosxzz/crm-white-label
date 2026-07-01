"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchConversationItems, fetchWhatsAppGroupItems } from "@/lib/chat/client";
import type { ConversationListItem, WhatsAppGroupListItem } from "@/lib/chat/types";
import { ConversationList } from "@/app/(app)/chat/conversation-list";

/** Fallback se realtime falhar; grupos sao mais pesados e mudam menos. */
const CONTACT_POLL_MS = 12_000;
const GROUP_POLL_MS = 45_000;

export function ConversationListLive({
  tenantId,
  initialItems,
  initialGroups,
}: {
  tenantId: string;
  initialItems: ConversationListItem[];
  initialGroups: WhatsAppGroupListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [groups, setGroups] = useState(initialGroups);
  const contactRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshContacts = useCallback(async () => {
    try {
      const next = await fetchConversationItems(tenantId);
      setItems(next);
    } catch {
      /* mantem lista anterior */
    }
  }, [tenantId]);

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

  const refreshGroups = useCallback(async () => {
    try {
      const nextGroups = await fetchWhatsAppGroupItems(tenantId);
      setGroups(nextGroups);
    } catch {
      /* mantem lista anterior */
    }
  }, [tenantId]);

  const scheduleContactsRefresh = useCallback(() => {
    if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
    contactRefreshTimerRef.current = setTimeout(() => void refreshContacts(), 1200);
  }, [refreshContacts]);

  const scheduleGroupsRefresh = useCallback(() => {
    if (groupRefreshTimerRef.current) clearTimeout(groupRefreshTimerRef.current);
    groupRefreshTimerRef.current = setTimeout(() => void refreshGroups(), 3500);
  }, [refreshGroups]);

  useEffect(() => {
    setItems(initialItems);
    setGroups(initialGroups);
  }, [initialItems, initialGroups]);

  useEffect(() => {
    const timer = setTimeout(() => void syncMissingProfilePictures(items), 600);
    return () => clearTimeout(timer);
  }, [items, syncMissingProfilePictures]);

  useEffect(() => {
    const contactTimer = setInterval(() => void refreshContacts(), CONTACT_POLL_MS);
    const groupTimer = setInterval(() => void refreshGroups(), GROUP_POLL_MS);
    return () => {
      clearInterval(contactTimer);
      clearInterval(groupTimer);
    };
  }, [refreshContacts, refreshGroups]);

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_groups",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => scheduleGroupsRefresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_group_label_assignments",
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => scheduleGroupsRefresh(),
      )
      .subscribe();

    return () => {
      if (contactRefreshTimerRef.current) clearTimeout(contactRefreshTimerRef.current);
      if (groupRefreshTimerRef.current) clearTimeout(groupRefreshTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [tenantId, scheduleContactsRefresh, scheduleGroupsRefresh]);

  return <ConversationList items={items} groups={groups} />;
}
