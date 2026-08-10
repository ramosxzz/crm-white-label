"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Zap, Settings2, Plus, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QuickMessage } from "@/lib/supabase/database.types";

export function QuickRepliesPicker({
  messages,
  onPick,
  disabled,
}: {
  messages: QuickMessage[];
  onPick: (message: QuickMessage) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 shrink-0 rounded-xl"
          disabled={disabled}
          aria-label="Mensagens rápidas"
          title="Mensagens rápidas"
        >
          <Zap className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          Mensagens rápidas
          <Link
            href="/mensagens-rapidas"
            className="inline-flex items-center gap-1 text-xs font-normal text-brand hover:underline"
            title="Organizar mensagens rápidas"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Organizar
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {messages.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma mensagem rápida ainda.</p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-lg">
              <Link href="/mensagens-rapidas">
                <Plus className="h-3.5 w-3.5" /> Criar mensagens
              </Link>
            </Button>
          </div>
        ) : (
          messages.map((m, index) => (
            <DropdownMenuItem
              key={m.id}
              className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
              onSelect={() => onPick(m)}
              asChild
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(index, 8) * 0.025 }}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {m.media_type === "audio" && <Mic className="h-3.5 w-3.5 text-brand" />}
                  {m.title}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {m.media_type === "audio" ? "Áudio pronto para prévia" : m.body}
                </span>
              </motion.div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
