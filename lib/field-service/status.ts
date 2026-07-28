import type { ServiceOrderStatus } from "../supabase/database.types";

/**
 * Fluxo da ordem de servico, do jeito que a operacao funciona hoje no papel:
 *
 *   rascunho -> agendada -> em_execucao -> concluida -> conferida -> faturada
 *
 * "concluida" e o tecnico dando OK em campo. "conferida" e o pre-fechamento
 * do ADM (aprova/rejeita o upsell que o tecnico lancou na residencia).
 * "faturada" e a liberacao da gestao, que na fase 3 gera o lancamento
 * financeiro e as comissoes.
 *
 * Reabertura e permitida nos dois sentidos que a equipe usa de verdade:
 * conferencia que achou erro volta pra em_execucao, e faturamento so acontece
 * depois da conferencia.
 */
const transitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
  rascunho: ["agendada", "cancelada"],
  agendada: ["em_execucao", "remarcada", "cancelada"],
  em_execucao: ["concluida", "remarcada", "cancelada"],
  concluida: ["conferida", "em_execucao"],
  conferida: ["faturada", "concluida"],
  faturada: [],
  cancelada: [],
  // Remarcada volta pra fila de agendamento com data nova.
  remarcada: ["agendada", "cancelada"],
};

export function canTransitionServiceOrder(from: ServiceOrderStatus, to: ServiceOrderStatus) {
  return transitions[from].includes(to);
}

export function nextServiceOrderStatuses(from: ServiceOrderStatus): ServiceOrderStatus[] {
  return transitions[from];
}

export function isServiceOrderClosed(status: ServiceOrderStatus) {
  return transitions[status].length === 0;
}

/** Status a partir do qual o valor da OS nao deve mais mudar sozinho. */
export function isServiceOrderLocked(status: ServiceOrderStatus) {
  return status === "faturada" || status === "cancelada";
}

export const SERVICE_ORDER_STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  conferida: "Conferida",
  faturada: "Faturada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
};

export const SERVICE_ORDER_SHIFT_LABEL = {
  manha: "Manhã",
  tarde: "Tarde",
} as const;

/** Numero visivel da OS (code_seq e sequencial por tenant). */
export function formatServiceOrderCode(codeSeq: number) {
  return `OS-${String(codeSeq).padStart(4, "0")}`;
}
