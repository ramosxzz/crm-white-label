import type { SupabaseClient } from "@supabase/supabase-js";

/** Retorna a conta de WhatsApp que o lead usa (a da conversa dele), caindo na
 * primeira conta ativa do tenant se a conversa nao tiver conta vinculada.
 * Garante que envios automaticos saiam do MESMO numero que o lead falou,
 * mesmo quando o tenant tem varias contas (um numero por vendedor). */
export async function getWhatsAppAccountForLead(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string | null,
) {
  if (leadId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("whatsapp_account_id")
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .eq("channel", "whatsapp")
      .not("whatsapp_account_id", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const accId = (conv as { whatsapp_account_id?: string | null } | null)?.whatsapp_account_id;
    if (accId) {
      const { data: acc } = await supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("id", accId)
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();
      if (acc) return acc;
    }
  }
  const { data: fallback } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return fallback ?? null;
}
