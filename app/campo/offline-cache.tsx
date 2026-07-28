"use client";

import { useEffect } from "react";
import { cacheOrders } from "@/lib/field-service/offline";
import { rememberStoragePrefix } from "./sync";

/**
 * Grava o turno no IndexedDB assim que a tela carrega conectada. E o que
 * permite o tecnico abrir a OS na casa do cliente sem sinal.
 *
 * Tambem guarda o prefixo do storage: sem ele nao da pra montar o caminho do
 * arquivo de assinatura offline, ja que o tenantId so vem do servidor.
 */
export function OfflineCache({
  orders,
  storagePrefix,
}: {
  orders: Array<{ id: string } & Record<string, unknown>>;
  storagePrefix: string;
}) {
  useEffect(() => {
    rememberStoragePrefix(storagePrefix);
    void cacheOrders(orders).catch(() => {
      // Sem IndexedDB o app segue funcionando online; so perde o offline.
    });
  }, [orders, storagePrefix]);

  return null;
}
