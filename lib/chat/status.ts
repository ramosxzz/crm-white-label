import { Inbox, Clock, MessageSquareDot, CheckCircle2, type LucideIcon } from "lucide-react";
import type { ConversationStatus } from "./types";

export type StatusMeta = {
  value: ConversationStatus;
  label: string;
  short: string;
  icon: LucideIcon;
  /** classe de cor do ponto/indicador */
  dot: string;
  /** classe de cor para pílulas ativas */
  pill: string;
  /** cor do texto/ícone */
  text: string;
};

// Paleta reduzida de proposito: roxo (marca) pra "novo, precisa ser pego",
// amarelo pra "esperando alguem responder", verde pra "sendo atendido",
// cinza pra "resolvido". Antes "aguardando" usava azul e "novos" usava
// amarelo - cor sem relacao com o que ela deveria significar (amarelo =
// atencao/pendencia em qualquer outro lugar do sistema).
export const CONVERSATION_STATUSES: StatusMeta[] = [
  {
    value: "nao_iniciada",
    label: "Não iniciado",
    short: "Novos",
    icon: Inbox,
    dot: "bg-brand",
    pill: "bg-brand/15 text-brand border-brand/30",
    text: "text-brand",
  },
  {
    value: "aguardando",
    label: "Aguardando",
    short: "Aguardando",
    icon: Clock,
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "em_atendimento",
    label: "Em atendimento",
    short: "Atendendo",
    icon: MessageSquareDot,
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "resolvida",
    label: "Resolvido",
    short: "Resolvidos",
    icon: CheckCircle2,
    dot: "bg-muted-foreground/50",
    pill: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
  },
];

export const STATUS_META: Record<ConversationStatus, StatusMeta> = Object.fromEntries(
  CONVERSATION_STATUSES.map((s) => [s.value, s]),
) as Record<ConversationStatus, StatusMeta>;
