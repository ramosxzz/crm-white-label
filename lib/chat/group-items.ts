import type { GroupLabelItem, WhatsAppGroupListItem } from "./types";

type GroupRow = {
  id: string;
  provider_group_id: string;
  subject: string;
  description: string | null;
  participant_count: number | null;
  last_event_type: string | null;
  last_event_at: string | null;
  updated_at: string;
  last_message_body?: string | null;
  last_message_direction?: string | null;
  last_message_at?: string | null;
};

type AssignmentRow = {
  group_id: string;
  whatsapp_group_labels: GroupLabelItem | GroupLabelItem[] | null;
};

type GroupMessageLogRow = {
  contact_lid: string | null;
  from_me: boolean | null;
  payload: unknown;
  created_at: string;
};

type MessagePreview = {
  body: string;
  direction: "inbound" | "outbound";
  messageAt: string;
};

function normalizeLabels(assignments: AssignmentRow[], groupId: string): GroupLabelItem[] {
  return assignments
    .filter((assignment) => assignment.group_id === groupId)
    .flatMap((assignment) => {
      const label = assignment.whatsapp_group_labels;
      if (!label) return [];
      return Array.isArray(label) ? label : [label];
    })
    .filter((label) => label.id && label.name)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function previewFromLog(log: GroupMessageLogRow): { groupJid: string; preview: MessagePreview } | null {
  const payload = isRecord(log.payload) ? log.payload : {};
  const groupJid = readString(payload.provider_group_id) ?? readString(payload.remote_jid) ?? readString(log.contact_lid);
  const body =
    readString(payload.body) ??
    readString(payload.text) ??
    readString(payload.message_text) ??
    readString(payload.caption);

  if (!groupJid || !body) return null;

  const payloadDirection = readString(payload.direction);
  const direction = payloadDirection === "outbound" || log.from_me ? "outbound" : "inbound";
  const messageAt = readString(payload.message_at) ?? readString(payload.timestamp) ?? log.created_at;

  return {
    groupJid,
    preview: {
      body,
      direction,
      messageAt,
    },
  };
}

function buildPreviewMap(logs: GroupMessageLogRow[]): Map<string, MessagePreview> {
  const previews = new Map<string, MessagePreview>();
  const sortedLogs = [...logs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  for (const log of sortedLogs) {
    const parsed = previewFromLog(log);
    if (!parsed || previews.has(parsed.groupJid)) continue;
    previews.set(parsed.groupJid, parsed.preview);
  }

  return previews;
}

function dateValue(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildWhatsAppGroupItems(
  groups: GroupRow[],
  assignments: AssignmentRow[],
  messageLogs: GroupMessageLogRow[] = [],
): WhatsAppGroupListItem[] {
  const logPreviews = buildPreviewMap(messageLogs);

  return groups
    .map((group) => {
      const logPreview = logPreviews.get(group.provider_group_id);
      const direction =
        group.last_message_direction === "outbound" || group.last_message_direction === "inbound"
          ? group.last_message_direction
          : (logPreview?.direction ?? null);
      return {
        id: group.id,
        providerGroupId: group.provider_group_id,
        subject: group.subject,
        description: group.description,
        participantCount: group.participant_count,
        lastEventType: group.last_event_type,
        lastAt: group.last_message_at ?? logPreview?.messageAt ?? group.last_event_at ?? group.updated_at,
        lastPreview: group.last_message_body ?? logPreview?.body ?? null,
        lastDirection: direction,
        labels: normalizeLabels(assignments, group.id),
      };
    })
    .sort((a, b) => dateValue(b.lastAt) - dateValue(a.lastAt));
}
