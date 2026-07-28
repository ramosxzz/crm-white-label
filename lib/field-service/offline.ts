"use client";

import {
  flushQueue,
  type FlushHandler,
  type FlushOutcome,
  type QueuedMutation,
  type QueuedMutationKind,
} from "./offline-queue";

/**
 * Persistencia offline do app do tecnico.
 *
 * Fica no cliente (IndexedDB) em vez de no service worker de proposito: o
 * public/sw.js atual e network-first pra todo o CRM e ja causou problema de
 * Server Action obsoleta uma vez. Mexer nele pra cachear dado do tecnico
 * arriscaria o app inteiro; aqui o escopo e so /campo.
 */

const DB_NAME = "solaire-field-service";
const DB_VERSION = 1;
const STORE_ORDERS = "orders";
const STORE_QUEUE = "queue";

export type CachedOrder = {
  id: string;
  cachedAt: number;
  payload: Record<string, unknown>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponivel neste navegador"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        db.createObjectStore(STORE_ORDERS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o banco local"));
  });
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = operation(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Falha no banco local"));
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Guarda as OS do turno pra abrir sem rede. */
export async function cacheOrders(orders: Array<{ id: string } & Record<string, unknown>>) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ORDERS, "readwrite");
    const store = tx.objectStore(STORE_ORDERS);
    store.clear();
    for (const order of orders) {
      store.put({ id: order.id, cachedAt: Date.now(), payload: order } satisfies CachedOrder);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao salvar OS localmente"));
  });
}

export async function readCachedOrders(): Promise<CachedOrder[]> {
  try {
    const rows = await runTransaction<CachedOrder[]>(STORE_ORDERS, "readonly", (store) =>
      store.getAll() as IDBRequest<CachedOrder[]>,
    );
    return rows.sort((a, b) => a.cachedAt - b.cachedAt);
  } catch {
    return [];
  }
}

export async function queueMutation(input: {
  kind: QueuedMutationKind;
  serviceOrderId: string;
  payload: Record<string, unknown>;
  blob?: Blob;
}): Promise<QueuedMutation> {
  const item: QueuedMutation = {
    id: crypto.randomUUID(),
    kind: input.kind,
    serviceOrderId: input.serviceOrderId,
    createdAt: Date.now(),
    payload: input.payload,
    blob: input.blob,
    attempts: 0,
  };
  await runTransaction(STORE_QUEUE, "readwrite", (store) => store.put(item));
  return item;
}

export async function readQueue(): Promise<QueuedMutation[]> {
  try {
    return await runTransaction<QueuedMutation[]>(STORE_QUEUE, "readonly", (store) =>
      store.getAll() as IDBRequest<QueuedMutation[]>,
    );
  } catch {
    return [];
  }
}

export async function pendingCount() {
  return (await readQueue()).length;
}

async function removeFromQueue(id: string) {
  await runTransaction(STORE_QUEUE, "readwrite", (store) => store.delete(id));
}

async function markAttempt(id: string, error: string) {
  const items = await readQueue();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  await runTransaction(STORE_QUEUE, "readwrite", (store) =>
    store.put({ ...item, attempts: item.attempts + 1, lastError: error }),
  );
}

/**
 * Tenta enviar tudo que esta pendente. Item enviado sai da fila; item que
 * falhou volta com attempts+1 e e tentado de novo na proxima conexao.
 */
export async function syncPending(handler: FlushHandler): Promise<FlushOutcome> {
  const items = await readQueue();
  if (items.length === 0) {
    return { sent: [], failed: [], abandoned: [] };
  }

  const outcome = await flushQueue(items, handler);

  // dedupeQueue pode ter descartado assinaturas antigas da mesma OS: elas
  // nao foram enviadas, mas tambem nao devem continuar ocupando a fila.
  const settled = new Set(outcome.sent);
  const stillFailing = new Set(outcome.failed.map((entry) => entry.id));
  const abandoned = new Set(outcome.abandoned);

  for (const item of items) {
    if (settled.has(item.id)) {
      await removeFromQueue(item.id);
      continue;
    }
    if (stillFailing.has(item.id)) {
      const failure = outcome.failed.find((entry) => entry.id === item.id);
      await markAttempt(item.id, failure?.error ?? "falha desconhecida");
      continue;
    }
    if (abandoned.has(item.id)) continue;
    // Superseded (ex: assinatura antiga da mesma OS) - descarta.
    await removeFromQueue(item.id);
  }

  return outcome;
}

export async function clearQueue() {
  await runTransaction(STORE_QUEUE, "readwrite", (store) => store.clear());
}

export type { QueuedMutation, QueuedMutationKind, FlushOutcome };
