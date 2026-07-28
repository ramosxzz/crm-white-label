"use client";

import { createClient } from "@/lib/supabase/client";
import { syncPending, type QueuedMutation } from "@/lib/field-service/offline";
import { addDamage, addFieldUpsellItem, fieldTransition, saveSignature } from "./actions";

export const FIELD_BUCKET = "service-orders";

/**
 * O prefixo do storage (tenantId) vem do servidor no carregamento da tela e
 * fica guardado aqui: sem isso o tecnico offline nao conseguiria montar o
 * caminho do arquivo pra enfileirar a assinatura.
 */
const PREFIX_KEY = "solaire-field-storage-prefix";

export function rememberStoragePrefix(prefix: string) {
  try {
    localStorage.setItem(PREFIX_KEY, prefix);
  } catch {
    // Modo privado / storage bloqueado: seguimos sem cache do prefixo.
  }
}

export function readStoragePrefix(): string | null {
  try {
    return localStorage.getItem(PREFIX_KEY);
  } catch {
    return null;
  }
}

export function buildFilePath(orderId: string, fileName: string) {
  const prefix = readStoragePrefix();
  if (!prefix) throw new Error("Abra o app conectado pelo menos uma vez antes de usar offline.");
  return `${prefix}/${orderId}/${crypto.randomUUID()}-${fileName}`;
}

async function uploadBlob(path: string, blob: Blob, contentType: string) {
  const supabase = createClient();
  const { error } = await supabase.storage.from(FIELD_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  });
  if (error) throw new Error(error.message);
}

/**
 * Traduz um item da fila offline na chamada real. Roda tanto no envio
 * imediato (online) quanto no flush depois que a conexao volta - e o mesmo
 * caminho de codigo nos dois casos, entao o comportamento nao diverge.
 */
export async function applyMutation(item: QueuedMutation) {
  switch (item.kind) {
    case "signature": {
      const path = item.payload.storage_path as string;
      if (item.blob) await uploadBlob(path, item.blob, "image/png");
      await saveSignature({
        service_order_id: item.serviceOrderId,
        storage_path: path,
        signer_name: item.payload.signer_name as string,
      });
      return;
    }
    case "damage": {
      const path = (item.payload.photo_path as string | null) ?? null;
      if (item.blob && path) {
        await uploadBlob(path, item.blob, item.blob.type || "image/jpeg");
      }
      await addDamage({
        service_order_id: item.serviceOrderId,
        description: item.payload.description as string,
        photo_path: path,
      });
      return;
    }
    case "upsell_item": {
      await addFieldUpsellItem({
        service_order_id: item.serviceOrderId,
        description: item.payload.description as string,
        quantity: item.payload.quantity as number,
        unit_price: item.payload.unit_price as number,
      });
      return;
    }
    case "status": {
      await fieldTransition({
        service_order_id: item.serviceOrderId,
        to: item.payload.to as "em_execucao" | "concluida" | "remarcada",
        reason: (item.payload.reason as string | undefined) ?? undefined,
      });
      return;
    }
  }
}

export function syncNow() {
  return syncPending(applyMutation);
}
