import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { findLeadByPhone } from "./find-by-phone";

type SB = SupabaseClient<Database>;

export type LeadContactMatch = {
  id: string;
  name: string | null;
  phone: string | null;
  whatsapp_lid: string | null;
  custom_fields?: any;
};

export async function findLeadByContact(
  supabase: SB,
  tenantId: string,
  contact: { phone?: string | null; lid?: string | null },
): Promise<LeadContactMatch | null> {
  if (contact.phone) {
    const byPhone = await findLeadByPhone(supabase, tenantId, contact.phone);
    if (byPhone) {
      const { data: row } = await supabase
        .from("leads")
        .select("id, name, phone, whatsapp_lid, custom_fields")
        .eq("id", byPhone.id)
        .eq("tenant_id", tenantId)
        .single();
      if (row) return row as LeadContactMatch;
    }
  }

  if (contact.lid) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone, whatsapp_lid, custom_fields")
      .eq("tenant_id", tenantId)
      .eq("whatsapp_lid", contact.lid)
      .maybeSingle();
    if (data) return data as LeadContactMatch;
  }

  return null;
}

export async function attachWhatsAppLidToLead(
  supabase: SB,
  leadId: string,
  tenantId: string,
  lid: string | null | undefined,
): Promise<void> {
  if (!lid) return;
  await supabase
    .from("leads")
    .update({ whatsapp_lid: lid })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);
}
