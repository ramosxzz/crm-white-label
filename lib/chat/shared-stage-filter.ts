"use client";

/**
 * Filtro de etapa compartilhado entre Chat e Kanban: filtrar por uma etapa
 * numa tela e refletir automaticamente na outra ao trocar de pagina.
 */
function storageKey(tenantId: string): string {
  return `crm:stage-filter:${tenantId}`;
}

export function getSharedStageFilter(tenantId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(tenantId));
  } catch {
    return null;
  }
}

export function setSharedStageFilter(tenantId: string, stageId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!stageId || stageId === "todos" || stageId === "none") {
      window.localStorage.removeItem(storageKey(tenantId));
    } else {
      window.localStorage.setItem(storageKey(tenantId), stageId);
    }
  } catch {
    /* localStorage indisponivel (modo privado etc) - ignora */
  }
}
