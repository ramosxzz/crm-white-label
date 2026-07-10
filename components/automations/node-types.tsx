"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
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
  Play,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "violet" | "blue" | "green" | "orange" | "yellow" | "pink" | "gray" | "amber" | "cyan" | "red" | "fuchsia" | "indigo" | "teal";

const ACCENT: Record<Accent, { chip: string; bar: string; ring: string }> = {
  violet: { chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400", bar: "bg-violet-500", ring: "ring-violet-500/40" },
  blue: { chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400", bar: "bg-blue-500", ring: "ring-blue-500/40" },
  green: { chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", ring: "ring-emerald-500/40" },
  orange: { chip: "bg-orange-500/15 text-orange-600 dark:text-orange-400", bar: "bg-orange-500", ring: "ring-orange-500/40" },
  yellow: { chip: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400", bar: "bg-yellow-500", ring: "ring-yellow-500/40" },
  pink: { chip: "bg-pink-500/15 text-pink-600 dark:text-pink-400", bar: "bg-pink-500", ring: "ring-pink-500/40" },
  gray: { chip: "bg-gray-500/15 text-gray-600 dark:text-gray-300", bar: "bg-gray-500", ring: "ring-gray-500/40" },
  amber: { chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400", bar: "bg-amber-500", ring: "ring-amber-500/40" },
  cyan: { chip: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400", bar: "bg-cyan-500", ring: "ring-cyan-500/40" },
  red: { chip: "bg-red-500/15 text-red-600 dark:text-red-400", bar: "bg-red-500", ring: "ring-red-500/40" },
  fuchsia: { chip: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400", bar: "bg-fuchsia-500", ring: "ring-fuchsia-500/40" },
  indigo: { chip: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400", bar: "bg-indigo-500", ring: "ring-indigo-500/40" },
  teal: { chip: "bg-teal-500/15 text-teal-600 dark:text-teal-400", bar: "bg-teal-500", ring: "ring-teal-500/40" },
};

type Meta = { label: string; sub: string; icon: React.ComponentType<{ className?: string }>; accent: Accent };

const kindMeta: Record<string, Meta> = {
  // Triggers
  lead_created: { label: "Lead criado", sub: "Gatilho", icon: Zap, accent: "violet" },
  stage_changed: { label: "Etapa alterada", sub: "Gatilho", icon: MoveRight, accent: "violet" },
  message_received: { label: "Mensagem recebida", sub: "Gatilho", icon: Send, accent: "violet" },
  appointment_created: { label: "Agendamento criado", sub: "Gatilho", icon: Zap, accent: "violet" },
  appointment_near: { label: "Agendamento próximo", sub: "Gatilho", icon: Clock, accent: "violet" },
  lead_inactive: { label: "Lead inativo", sub: "Gatilho", icon: Clock, accent: "violet" },
  // Actions
  send_message: { label: "Enviar mensagem", sub: "Mensagem", icon: Send, accent: "blue" },
  move_stage: { label: "Mover etapa", sub: "Ação", icon: MoveRight, accent: "green" },
  assign_lead: { label: "Atribuir lead", sub: "Ação", icon: UserCheck, accent: "orange" },
  create_task: { label: "Criar tarefa", sub: "Ação", icon: ListTodo, accent: "yellow" },
  api4com_call: { label: "Ligação", sub: "Api4com", icon: PhoneCall, accent: "green" },
  add_tag: { label: "Adicionar tag", sub: "Ação", icon: Tag, accent: "pink" },
  log_activity: { label: "Registrar atividade", sub: "Ação", icon: ActivitySquare, accent: "gray" },
  field_ops: { label: "Operações de campos", sub: "Ação", icon: SlidersHorizontal, accent: "teal" },
  api_call: { label: "Requisição API", sub: "Integração", icon: Webhook, accent: "indigo" },
  ai: { label: "IA", sub: "Inteligência", icon: Sparkles, accent: "fuchsia" },
  javascript: { label: "JavaScript", sub: "Código", icon: Code2, accent: "amber" },
  // Control
  wait: { label: "Aguardar", sub: "Controle", icon: Clock, accent: "amber" },
  condition: { label: "Condição", sub: "Controle", icon: GitBranch, accent: "cyan" },
  randomizer: { label: "Randomizador", sub: "Controle", icon: Shuffle, accent: "indigo" },
  end: { label: "Encerrar", sub: "Controle", icon: X, accent: "red" },
};

type Stats = { success?: number; alert?: number; error?: number };

function configPreview(kind: string, config: Record<string, unknown>): string | null {
  if (kind === "send_message" && config.message) return `"${String(config.message)}"`;
  if (kind === "wait" && config.minutes) return `Aguardar ${String(config.minutes)} min`;
  if (kind === "create_task" && config.title) return `Tarefa: ${String(config.title)}`;
  if (kind === "api4com_call" && config.extension) return `Ramal ${String(config.extension)}`;
  if (kind === "add_tag" && config.tag) return `#${String(config.tag)}`;
  if (kind === "move_stage" && config.stage_id) return `→ etapa selecionada`;
  if (kind === "assign_lead" && config.user_id) return `→ responsável`;
  if (kind === "condition" && config.field) return `${String(config.field)} ${String(config.operator ?? "=")} ${String(config.value ?? "")}`;
  if (kind === "api_call" && config.url) return String(config.url);
  if (kind === "randomizer" && config.branches) return `${String(config.branches)} caminhos`;
  return null;
}

function Counters({ stats }: { stats: Stats }) {
  const cells = [
    { label: "Sucessos", value: stats.success ?? 0, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Alertas", value: stats.alert ?? 0, color: "text-amber-600 dark:text-amber-400" },
    { label: "Erros", value: stats.error ?? 0, color: "text-red-600 dark:text-red-400" },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
      {cells.map((c) => (
        <div key={c.label} className="px-2 py-1.5 text-center">
          <p className={cn("text-sm font-semibold tabular-nums", c.color)}>{c.value}</p>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

const HANDLE = "!h-3 !w-3 !rounded-full !border-2 !border-background !bg-brand";

function FlowNode({
  data,
  selected,
  isTrigger,
  isCondition,
  isEnd,
}: NodeProps & { isTrigger?: boolean; isCondition?: boolean; isEnd?: boolean }) {
  const kind = (data.kind as string) ?? (data.type as string);
  const meta = kindMeta[kind] ?? { label: kind, sub: "Bloco", icon: Zap, accent: "gray" as Accent };
  const accent = ACCENT[meta.accent];
  const Icon = meta.icon;
  const label = (data.label as string) ?? meta.label;
  const config = (data.config as Record<string, unknown>) ?? {};
  const stats = (data.stats as Stats) ?? {};
  const preview = configPreview(kind, config);

  return (
    <div
      className={cn(
        "w-[280px] overflow-hidden rounded-2xl border bg-card shadow-lg transition-all",
        selected ? cn("ring-2 ring-offset-2 ring-offset-background", accent.ring) : "border-border/70",
      )}
    >
      {!isTrigger && <Handle type="target" position={Position.Top} className={HANDLE} />}

      {/* Accent bar */}
      <div className={cn("h-1 w-full", accent.bar)} />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", accent.chip)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground">{isTrigger ? "Início" : meta.sub}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-3.5 pb-3">
        {isTrigger ? (
          <p className="rounded-lg bg-muted/50 px-2.5 py-2 text-[11px] text-muted-foreground">
            Quando este evento ocorrer, a automação inicia.
          </p>
        ) : preview ? (
          <p className="line-clamp-2 rounded-lg bg-muted/40 px-2.5 py-2 text-[11px] text-foreground/80">
            {preview}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 px-2.5 py-2 text-[11px] italic text-muted-foreground">
            Clique para configurar
          </p>
        )}
      </div>

      {/* Condition branches */}
      {isCondition && (
        <div className="grid grid-cols-2 border-t border-border/60 text-[10px] font-medium">
          <div className="relative border-r border-border/60 px-2 py-2 text-center text-emerald-600 dark:text-emerald-400">
            Se verdadeiro
            <Handle
              type="source"
              position={Position.Bottom}
              id="yes"
              style={{ left: "25%" }}
              className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-emerald-500"
            />
          </div>
          <div className="relative px-2 py-2 text-center text-red-500">
            Senão
            <Handle
              type="source"
              position={Position.Bottom}
              id="no"
              style={{ left: "75%" }}
              className="!h-3 !w-3 !rounded-full !border-2 !border-background !bg-red-400"
            />
          </div>
        </div>
      )}

      {/* Counters footer */}
      {!isEnd && <Counters stats={stats} />}

      {/* Default source handle */}
      {!isEnd && !isCondition && <Handle type="source" position={Position.Bottom} className={HANDLE} />}
    </div>
  );
}

export function TriggerNode(props: NodeProps) {
  return <FlowNode {...props} isTrigger />;
}
TriggerNode.displayName = "TriggerNode";

export function ActionNode(props: NodeProps) {
  return <FlowNode {...props} />;
}
ActionNode.displayName = "ActionNode";

export function ConditionNode(props: NodeProps) {
  return <FlowNode {...props} isCondition />;
}
ConditionNode.displayName = "ConditionNode";

export function WaitNode(props: NodeProps) {
  return <FlowNode {...props} />;
}
WaitNode.displayName = "WaitNode";

export function EndNode(props: NodeProps) {
  return <FlowNode {...props} isEnd />;
}
EndNode.displayName = "EndNode";
