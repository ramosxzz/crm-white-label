"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellRing, Check, Inbox, Users, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/supabase/database.types";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(app)/_actions/notifications";

export function NotificationsBell({
  initial,
  currentUserId,
  tenantId,
}: {
  initial: Notification[];
  currentUserId: string;
  tenantId: string;
}) {
  const [items, setItems] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const unread = items.filter((n) => !n.is_read).length;

  useEffect(() => {
    function isVisible(n: Notification) {
      return !n.user_id || n.user_id === currentUserId;
    }

    const supabase = createClient();
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `tenant_id=eq.${tenantId}` },
        (p) => {
          const next = p.new as Notification;
          if (!isVisible(next)) return;
          setItems((prev) => [next, ...prev].slice(0, 20));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `tenant_id=eq.${tenantId}` },
        (p) => {
          const next = p.new as Notification;
          if (!isVisible(next)) {
            setItems((prev) => prev.filter((n) => n.id !== next.id));
            return;
          }
          setItems((prev) => prev.map((n) => (n.id === next.id ? next : n)));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId, tenantId]);

  function onMarkAllRead() {
    start(async () => {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    });
  }

  function onClickItem(n: Notification) {
    if (!n.is_read) {
      void markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    }
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificacoes">
          {unread > 0 ? <BellRing className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold leading-none text-brand-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="font-display text-sm font-semibold">Notificacoes</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} nao lidas` : "Tudo em dia"}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllRead} disabled={pending}>
              <Check className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Inbox className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Sem notificacoes</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Voce sera avisado quando um lead novo entrar.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => (
                <NotificationItem key={n.id} n={n} onClick={() => onClickItem(n)} />
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({ n, onClick }: { n: Notification; onClick: () => void }) {
  const Icon = iconFor(n.kind);
  const Tag = n.link ? Link : ("button" as const);
  return (
    <li>
      <Tag
        href={n.link ?? "#"}
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
          !n.is_read && "bg-brand/5",
        )}
      >
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 overflow-hidden">
          <span className="flex items-center gap-2">
            <span className={cn("text-sm", !n.is_read ? "font-semibold" : "font-medium")}>{n.title}</span>
            {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
          </span>
          {n.description && (
            <span className="block truncate text-xs text-muted-foreground">{n.description}</span>
          )}
          <span className="block text-[10px] text-muted-foreground" suppressHydrationWarning>
            {formatDistanceToNow(new Date(n.created_at), { locale: ptBR, addSuffix: true })}
          </span>
        </span>
      </Tag>
    </li>
  );
}

function iconFor(kind: string) {
  if (kind.startsWith("lead")) return Users;
  if (kind.startsWith("message") || kind.startsWith("chat")) return MessageCircle;
  return Bell;
}
