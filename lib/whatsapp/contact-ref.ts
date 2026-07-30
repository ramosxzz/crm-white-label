import { normalizeWhatsAppLid } from "./lid";
import { isValidWhatsAppPhone, normalizeWhatsAppPhone, phonesEquivalent } from "./phone";
import type { ZapiWebhookPayload } from "./zapi";

export type WhatsAppContactRef = {
  phone: string | null;
  lid: string | null;
};

function tryPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (raw.includes("@lid") || raw.includes("@g.us") || raw.includes("broadcast")) {
    return null;
  }
  const normalized = normalizeWhatsAppPhone(raw);
  if (normalized && isValidWhatsAppPhone(normalized)) return normalized;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 15) {
    const retry = normalizeWhatsAppPhone(digits);
    if (retry && isValidWhatsAppPhone(retry)) return retry;
  }
  return null;
}

function collectLidCandidates(p: ZapiWebhookPayload): (string | null | undefined)[] {
  return [p.chatLid, p.senderLid, p.participantPhone, p.phone, (p as { lid?: string }).lid];
}

function collectPhoneCandidates(p: ZapiWebhookPayload, fromMe: boolean): (string | null | undefined)[] {
  return fromMe
    ? [p.participantPhone, p.phone, p.senderPhone]
    : [p.phone, p.participantPhone, p.senderPhone];
}

/** Resolve telefone internacional e/ou @lid do payload Z-API. */
export function resolveZapiContact(
  p: ZapiWebhookPayload,
  fromMe: boolean,
  accountPhone?: string,
): WhatsAppContactRef | null {
  const connected = tryPhone(p.connectedPhone) || tryPhone(accountPhone);

  let phone: string | null = null;
  for (const raw of collectPhoneCandidates(p, fromMe)) {
    const normalized = tryPhone(raw);
    if (!normalized) continue;
    if (fromMe && connected && phonesEquivalent(normalized, connected)) continue;
    phone = normalized;
    break;
  }

  let lid: string | null = null;
  for (const raw of collectLidCandidates(p)) {
    const normalized = normalizeWhatsAppLid(raw);
    if (normalized) {
      lid = normalized;
      break;
    }
  }

  if (!phone && lid) {
    for (const raw of collectPhoneCandidates(p, fromMe)) {
      const normalized = normalizeWhatsAppLid(raw);
      if (normalized) {
        lid = normalized;
        break;
      }
    }
  }

  if (!phone && !lid) return null;
  return { phone, lid };
}
