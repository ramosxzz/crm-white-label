/**
 * Logica pura da fila offline do app do tecnico.
 *
 * Separada do IndexedDB de proposito: a parte que decide ordem, deduplicacao
 * e o que fazer quando um envio falha e testavel sem browser.
 */

export type QueuedMutationKind = "signature" | "damage" | "upsell_item" | "status";

export type QueuedMutation = {
  /** Chave local, gerada no cliente (a OS ainda pode nem ter sido tocada no servidor). */
  id: string;
  kind: QueuedMutationKind;
  serviceOrderId: string;
  createdAt: number;
  payload: Record<string, unknown>;
  /** Assinatura e foto viajam como Blob ate conseguir subir. */
  blob?: Blob;
  /** Quantas vezes ja tentamos enviar - usado pra parar de insistir. */
  attempts: number;
  lastError?: string;
};

export const MAX_ATTEMPTS = 5;

/**
 * Ordem de envio: mais antigo primeiro, mas com assinatura e status por
 * ultimo dentro da mesma OS. Motivo: assinar e concluir sao o fecho do
 * atendimento - se forem antes da avaria/upsell que o tecnico lancou, o
 * servidor recebe uma OS concluida e depois itens novos, que e justamente o
 * que a conferencia do ADM nao deve ver.
 */
const KIND_PRIORITY: Record<QueuedMutationKind, number> = {
  damage: 0,
  upsell_item: 0,
  signature: 1,
  status: 2,
};

export function sortQueue(items: QueuedMutation[]): QueuedMutation[] {
  return [...items].sort((a, b) => {
    if (a.serviceOrderId === b.serviceOrderId) {
      const priority = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
      if (priority !== 0) return priority;
    }
    return a.createdAt - b.createdAt;
  });
}

/**
 * Assinatura e status sao idempotentes por OS: se o tecnico assinou duas
 * vezes offline, so a ultima importa. Avaria e item de upsell sao
 * cumulativos e nunca sao descartados.
 */
export function dedupeQueue(items: QueuedMutation[]): QueuedMutation[] {
  const lastByKey = new Map<string, QueuedMutation>();
  const cumulative: QueuedMutation[] = [];

  for (const item of items) {
    if (item.kind === "signature" || item.kind === "status") {
      const key = `${item.serviceOrderId}:${item.kind}`;
      const existing = lastByKey.get(key);
      if (!existing || item.createdAt >= existing.createdAt) lastByKey.set(key, item);
    } else {
      cumulative.push(item);
    }
  }

  return sortQueue([...cumulative, ...lastByKey.values()]);
}

export function isExhausted(item: QueuedMutation) {
  return item.attempts >= MAX_ATTEMPTS;
}

export type FlushOutcome = {
  sent: string[];
  failed: Array<{ id: string; error: string }>;
  /** Itens que estouraram as tentativas e precisam de acao manual. */
  abandoned: string[];
};

export type FlushHandler = (item: QueuedMutation) => Promise<void>;

/**
 * Envia a fila em ordem. Falha de rede num item **nao** aborta o resto: o
 * tecnico pode ter avarias de OS diferentes na fila, e travar tudo por causa
 * de uma so significaria perder o turno inteiro. O item que falhou volta pra
 * fila com attempts+1.
 */
export async function flushQueue(
  items: QueuedMutation[],
  handler: FlushHandler,
): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { sent: [], failed: [], abandoned: [] };

  for (const item of dedupeQueue(items)) {
    if (isExhausted(item)) {
      outcome.abandoned.push(item.id);
      continue;
    }
    try {
      await handler(item);
      outcome.sent.push(item.id);
    } catch (error) {
      outcome.failed.push({
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return outcome;
}
