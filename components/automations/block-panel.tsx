"use client";

import {
  Zap,
  Send,
  GitBranch,
  Clock,
  Tag,
  UserCheck,
  ListTodo,
  ActivitySquare,
  MoveRight,
  PhoneCall,
  Shuffle,
  Webhook,
  Sparkles,
  Code2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BlockDef = {
  type: "trigger" | "action" | "condition" | "wait" | "end";
  kind: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chip: string;
  soon?: boolean;
};

const TRIGGERS: BlockDef[] = [
  { type: "trigger", kind: "lead_created", label: "Lead criado", icon: Zap, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { type: "trigger", kind: "stage_changed", label: "Etapa alterada", icon: MoveRight, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { type: "trigger", kind: "message_received", label: "Mensagem recebida", icon: Send, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  { type: "trigger", kind: "appointment_near", label: "Agendamento próximo", icon: Clock, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
];

const BASIC: BlockDef[] = [
  { type: "action", kind: "send_message", label: "Mensagem", icon: Send, chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { type: "condition", kind: "condition", label: "Condições", icon: GitBranch, chip: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" },
  { type: "wait", kind: "wait", label: "Espera", icon: Clock, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { type: "action", kind: "randomizer", label: "Randomizador", icon: Shuffle, chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { type: "action", kind: "api_call", label: "API", icon: Webhook, chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  { type: "action", kind: "field_ops", label: "Operações de campos", icon: SlidersHorizontal, chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  { type: "action", kind: "ai", label: "IA", icon: Sparkles, chip: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400" },
  { type: "action", kind: "javascript", label: "JavaScript", icon: Code2, chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
];

const ACTIONS: BlockDef[] = [
  { type: "action", kind: "move_stage", label: "Mover etapa", icon: MoveRight, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { type: "action", kind: "assign_lead", label: "Atribuir lead", icon: UserCheck, chip: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  { type: "action", kind: "create_task", label: "Criar tarefa", icon: ListTodo, chip: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" },
  { type: "action", kind: "api4com_call", label: "Ligação", icon: PhoneCall, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { type: "action", kind: "add_tag", label: "Adicionar tag", icon: Tag, chip: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  { type: "action", kind: "log_activity", label: "Registrar atividade", icon: ActivitySquare, chip: "bg-gray-500/15 text-gray-600 dark:text-gray-300" },
  { type: "end", kind: "end", label: "Encerrar", icon: X, chip: "bg-red-500/15 text-red-600 dark:text-red-400" },
];

const SECTIONS: { label: string; blocks: BlockDef[] }[] = [
  { label: "Gatilhos", blocks: TRIGGERS },
  { label: "Blocos básicos", blocks: BASIC },
  { label: "Ações", blocks: ACTIONS },
];

export function BlockPanel({
  onAddBlock,
}: {
  onAddBlock: (type: string, kind: string, label: string) => void;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-card/60">
      <div className="border-b border-border/60 px-4 py-3.5">
        <p className="font-display text-sm font-semibold">Blocos</p>
        <p className="text-[11px] text-muted-foreground">Clique para adicionar ao fluxo</p>
      </div>
      <div className="space-y-5 p-3">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
            <div className="space-y-1.5">
              {section.blocks.map((block) => {
                const Icon = block.icon;
                return (
                  <button
                    key={`${block.type}-${block.kind}`}
                    onClick={() => onAddBlock(block.type, block.kind, block.label)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl border border-border/50 bg-background px-2.5 py-2 text-left text-[13px] font-medium transition-all hover:border-brand/40 hover:shadow-sm",
                    )}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", block.chip)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 truncate">{block.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
