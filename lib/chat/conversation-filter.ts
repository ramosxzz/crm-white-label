import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { isSelfWhatsAppContact } from "@/lib/whatsapp/self-contact";
import { isValidWhatsAppPhone } from "@/lib/whatsapp/phone";

export type ConversationStatus =
  | "nao_iniciada"
  | "aguardando"
  | "em_atendimento"
  | "resolvida";

export type ConversationLeadRow = {
  id: string;
  lead_id: string;
  channel?: string | null;
  whatsapp_account_id?: string | null;
  last_message_at: string | null;
  unread_count: number | null;
  status?: ConversationStatus | null;
  leads: {
    name: string | null;
    phone: string | null;
    whatsapp_lid?: string | null;
    custom_fields?: Record<string, unknown> | null;
    tags?: string[] | null;
    stage_id?: string | null;
    created_at?: string | null;
    quality_stars?: number | null;
  } | null;
};

/** Remove ruído do WhatsApp e deduplica WhatsApp por telefone, sem esconder canais sem telefone. */
export function filterConversationRows(
  rows: ConversationLeadRow[],
  account: WhatsAppAccount | null,
): ConversationLeadRow[] {
  const whatsappRows = rows.filter((c) => (c.channel ?? "whatsapp") === "whatsapp");
  const otherChannels = rows.filter((c) => (c.channel ?? "whatsapp") !== "whatsapp");
  const valid = whatsappRows.filter((c) => isValidWhatsAppPhone(c.leads?.phone ?? ""));

  const withoutSelf = account
    ? valid.filter(
        (c) =>
          !isSelfWhatsAppContact(account, {
            phone: c.leads?.phone,
            lid: c.leads?.whatsapp_lid ?? null,
          }),
      )
    : valid;

  const byPhone = new Map<string, ConversationLeadRow>();
  for (const row of withoutSelf) {
    const phone = row.leads?.phone ?? "";
    if (!phone) continue;
    const prev = byPhone.get(phone);
    if (!prev) {
      byPhone.set(phone, row);
      continue;
    }
    const prevAt = prev.last_message_at ? Date.parse(prev.last_message_at) : 0;
    const rowAt = row.last_message_at ? Date.parse(row.last_message_at) : 0;
    if (rowAt >= prevAt) byPhone.set(phone, row);
  }

  return [...byPhone.values(), ...otherChannels].sort((a, b) => {
    const aAt = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const bAt = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    return bAt - aAt;
  });
}
