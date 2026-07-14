import type { DbMessageStatus, ZapiMessageStatusUpdate } from "./zapi-status";

// Baileys WAMessageStatus enum, usado pela Evolution API no evento messages.update.
const STATUS_CODE_MAP: Record<number, DbMessageStatus> = {
  0: "failed", // ERROR
  1: "pending", // PENDING
  2: "sent", // SERVER_ACK
  3: "delivered", // DELIVERY_ACK
  4: "read", // READ
  5: "read", // PLAYED (audio ouvido)
};

const STATUS_STRING_MAP: Record<string, DbMessageStatus> = {
  ERROR: "failed",
  PENDING: "pending",
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
};

function mapEvolutionStatus(raw: unknown): DbMessageStatus | null {
  if (typeof raw === "number") return STATUS_CODE_MAP[raw] ?? null;
  if (typeof raw === "string") {
    const upper = raw.trim().toUpperCase();
    if (upper in STATUS_STRING_MAP) return STATUS_STRING_MAP[upper];
    const asNumber = Number(raw);
    if (!Number.isNaN(asNumber)) return STATUS_CODE_MAP[asNumber] ?? null;
  }
  return null;
}

function extractEntries(payload: unknown): Record<string, unknown>[] {
  const p = payload as { data?: unknown };
  const data = p?.data ?? payload;
  if (Array.isArray(data)) return data.filter((d): d is Record<string, unknown> => Boolean(d && typeof d === "object"));
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

/** Converte o evento messages.update da Evolution API em atualizacoes de status no banco. */
export function parseEvolutionMessageStatusUpdates(payload: unknown): ZapiMessageStatusUpdate[] {
  const p = payload as { event?: string };
  if (p.event !== "messages.update") return [];

  const updates: ZapiMessageStatusUpdate[] = [];
  for (const entry of extractEntries(payload)) {
    const key = entry.key as { id?: string } | undefined;
    const externalId = key?.id ?? (entry.keyId as string | undefined);
    if (!externalId) continue;

    const statusRaw =
      (entry.update as { status?: unknown } | undefined)?.status ??
      entry.status ??
      (entry.data as { status?: unknown } | undefined)?.status;

    const status = mapEvolutionStatus(statusRaw);
    if (!status || status === "failed" || status === "pending") continue;

    updates.push({ externalIds: [externalId], status });
  }
  return updates;
}
