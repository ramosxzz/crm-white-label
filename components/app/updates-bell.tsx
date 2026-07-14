"use client";

import { useState, useTransition } from "react";
import { Megaphone, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SystemUpdate } from "@/lib/supabase/database.types";
import { markSystemUpdatesSeen } from "@/app/(app)/_actions/system-updates";

export function UpdatesBell({
  updates,
  hasUnread,
}: {
  updates: SystemUpdate[];
  hasUnread: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(hasUnread);
  const [, start] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread) {
      setUnread(false);
      start(() => markSystemUpdatesSeen());
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Novidades do sistema">
          <Megaphone className="h-[18px] w-[18px]" />
          {unread && (
            <span className="absolute right-1.5 top-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <Sparkles className="h-4 w-4 text-brand" />
          <div>
            <p className="font-display text-sm font-semibold">Novidades</p>
            <p className="text-[11px] text-muted-foreground">Atualizacoes recentes do CRM</p>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {updates.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Megaphone className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Nenhuma novidade ainda</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {updates.map((u) => (
                <li key={u.id} className="px-4 py-3">
                  <p className="text-sm font-semibold">{u.title}</p>
                  {u.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{u.body}</p>}
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { locale: ptBR, addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
