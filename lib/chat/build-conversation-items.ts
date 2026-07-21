import { displayLeadName, displayLeadSubtitle } from "@/lib/leads/display";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { getCachedWhatsAppProfilePicture } from "@/lib/whatsapp/profile-picture";
import { filterConversationRows, type ConversationLeadRow } from "./conversation-filter";
import type { ConversationListItem } from "./types";

type MessagePreview = { conversation_id: string; body: string | null; direction: string };

export function buildConversationItems(
  rows: ConversationLeadRow[],
  messagePreviews: MessagePreview[],
  account: WhatsAppAccount | null,
  options: { tenantName?: string | null } = {},
): ConversationListItem[] {
  const filtered = filterConversationRows(rows, account);

  const previewByConv: Record<string, { body: string; direction: string }> = {};
  for (const m of messagePreviews) {
    if (!previewByConv[m.conversation_id]) {
      previewByConv[m.conversation_id] = {
        body: m.body ?? "",
        direction: m.direction,
      };
    }
  }

  return filtered.map((c) => {
    const preview = previewByConv[c.id];
    return {
      id: c.id,
      leadId: c.lead_id,
      leadName: displayLeadName(c.leads?.name, c.leads?.phone, options.tenantName),
      leadPhone: c.leads?.phone ?? "",
      leadAvatarUrl: getCachedWhatsAppProfilePicture(c.leads?.custom_fields),
      leadSubtitle: (c.channel ?? "whatsapp") === "instagram" ? "Instagram" : displayLeadSubtitle(c.leads?.phone),
      lastAt: c.last_message_at,
      unread: c.unread_count ?? 0,
      lastPreview: preview?.body ?? null,
      lastDirection: preview?.direction ?? null,
      status: c.status ?? "nao_iniciada",
      whatsappAccountId: c.whatsapp_account_id ?? null,
      tags: c.leads?.tags ?? [],
      stageId: c.leads?.stage_id ?? null,
      leadCreatedAt: c.leads?.created_at ?? null,
    };
  });
}
