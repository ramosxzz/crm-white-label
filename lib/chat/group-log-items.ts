import type { GroupLabelItem, WhatsAppGroupListItem } from "./types";

export type GroupLogRow = {
  id: string;
  event_type: string | null;
  contact_lid: string | null;
  payload: unknown;
  created_at: string;
};

const GROUP_EVENTS = new Set(["GROUPS_UPSERT", "GROUP_UPDATE", "GROUP_PARTICIPANTS_UPDATE"]);
const LABEL_ADD = "GROUP_LABEL_ADD";
const LABEL_REMOVE = "GROUP_LABEL_REMOVE";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function readLabel(payload: Record<string, unknown>): GroupLabelItem | null {
  const label = record(payload.label);
  const id = text(label.id) ?? text(payload.label_id);
  const name = text(label.name) ?? text(payload.label_name);
  if (!id || !name) return null;
  return {
    id,
    name,
    color: text(label.color) ?? text(payload.label_color) ?? "#7c3aed",
  };
}

export function buildWhatsAppGroupItemsFromLogs(logs: GroupLogRow[]): WhatsAppGroupListItem[] {
  const groups = new Map<string, WhatsAppGroupListItem>();
  const labels = new Map<string, Map<string, GroupLabelItem>>();

  const chronologicalLogs = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const log of chronologicalLogs) {
    const payload = record(log.payload);
    const groupId = text(payload.provider_group_id) ?? log.contact_lid;
    if (!groupId) continue;

    if (log.event_type && GROUP_EVENTS.has(log.event_type)) {
      groups.set(groupId, {
        id: groupId,
        providerGroupId: groupId,
        subject: text(payload.subject) ?? groupId,
        description: text(payload.description),
        participantCount: numberValue(payload.participant_count),
        lastEventType: text(payload.last_event_type) ?? log.event_type,
        lastAt: text(payload.last_event_at) ?? log.created_at,
        lastPreview: null,
        lastDirection: null,
        unreadCount: 0,
        labels: [],
      });
      continue;
    }

    if (log.event_type === LABEL_ADD) {
      const label = readLabel(payload);
      if (!label) continue;
      const bucket = labels.get(groupId) ?? new Map<string, GroupLabelItem>();
      bucket.set(label.id, label);
      labels.set(groupId, bucket);
      continue;
    }

    if (log.event_type === LABEL_REMOVE) {
      const labelId = text(payload.label_id);
      if (!labelId) continue;
      labels.get(groupId)?.delete(labelId);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      labels: [...(labels.get(group.providerGroupId)?.values() ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    }))
    .sort((a, b) => new Date(b.lastAt ?? 0).getTime() - new Date(a.lastAt ?? 0).getTime());
}
