export type EvolutionGroupEvent = {
  provider_group_id: string;
  subject: string;
  description: string | null;
  owner_jid: string | null;
  participant_count: number | null;
  last_event_type: string;
  last_event_at: string;
  raw_payload: Record<string, unknown>;
};

const GROUP_EVENTS = new Set(["GROUPS_UPSERT", "GROUP_UPDATE", "GROUP_PARTICIPANTS_UPDATE"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventTime(payload: Record<string, unknown>): string {
  const raw = payload.subjectTime ?? payload.creation ?? payload.timestamp ?? payload.messageTimestamp;
  const numeric = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    return new Date(millis).toISOString();
  }
  return new Date().toISOString();
}

function getGroupId(payload: Record<string, unknown>): string | null {
  return (
    asString(payload.id) ??
    asString(payload.jid) ??
    asString(payload.remoteJid) ??
    asString(payload.groupJid) ??
    asString(payload.participant)
  );
}

function getParticipantCount(payload: Record<string, unknown>): number | null {
  const participants = payload.participants;
  if (Array.isArray(participants)) return participants.length;
  const size = payload.size ?? payload.participantCount ?? payload.participantsCount;
  if (typeof size === "number" && Number.isFinite(size)) return size;
  if (typeof size === "string" && size.trim() && Number.isFinite(Number(size))) return Number(size);
  return null;
}

function normalizeGroup(event: string, payload: Record<string, unknown>): EvolutionGroupEvent | null {
  const providerGroupId = getGroupId(payload);
  if (!providerGroupId || !providerGroupId.includes("@g.us")) return null;

  return {
    provider_group_id: providerGroupId,
    subject: asString(payload.subject) ?? asString(payload.name) ?? providerGroupId,
    description: asString(payload.desc) ?? asString(payload.description),
    owner_jid: asString(payload.owner) ?? asString(payload.subjectOwner) ?? asString(payload.ownerJid),
    participant_count: getParticipantCount(payload),
    last_event_type: event,
    last_event_at: eventTime(payload),
    raw_payload: payload,
  };
}

export function parseEvolutionGroupEvents(payload: unknown): EvolutionGroupEvent[] {
  const root = asRecord(payload);
  if (!root) return [];

  const event = asString(root.event)?.toUpperCase().replace(/[.\-]/g, "_");
  if (!event || !GROUP_EVENTS.has(event)) return [];

  const data = root.data;
  const rows = Array.isArray(data) ? data : [data];

  return rows
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .map((row) => normalizeGroup(event, row))
    .filter((row): row is EvolutionGroupEvent => Boolean(row));
}
