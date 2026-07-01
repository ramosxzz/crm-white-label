import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import type { Database, WhatsAppAccount } from "@/lib/supabase/database.types";

type SB = SupabaseClient<Database>;

const PROFILE_PIC_TTL_MS = 24 * 60 * 60 * 1000;

export const WHATSAPP_PROFILE_PIC_URL_FIELD = "whatsapp_profile_pic_url";
export const WHATSAPP_PROFILE_PIC_FETCHED_AT_FIELD = "whatsapp_profile_pic_fetched_at";

function stringField(fields: Record<string, unknown> | null | undefined, key: string) {
  const value = fields?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getCachedWhatsAppProfilePicture(fields: Record<string, unknown> | null | undefined) {
  return stringField(fields, WHATSAPP_PROFILE_PIC_URL_FIELD);
}

export function shouldRefreshWhatsAppProfilePicture(fields: Record<string, unknown> | null | undefined) {
  const fetchedAt = stringField(fields, WHATSAPP_PROFILE_PIC_FETCHED_AT_FIELD);
  if (!fetchedAt) return true;
  const time = Date.parse(fetchedAt);
  return !Number.isFinite(time) || Date.now() - time > PROFILE_PIC_TTL_MS;
}

export async function syncLeadWhatsAppProfilePicture(
  supabase: SB,
  account: WhatsAppAccount,
  lead: {
    id: string;
    tenant_id: string;
    phone: string | null;
    custom_fields?: Record<string, unknown> | null;
  },
) {
  if (!lead.phone) return getCachedWhatsAppProfilePicture(lead.custom_fields);
  if (!shouldRefreshWhatsAppProfilePicture(lead.custom_fields)) {
    return getCachedWhatsAppProfilePicture(lead.custom_fields);
  }

  const provider = createProvider(account);
  if (!provider.fetchProfilePicture) return getCachedWhatsAppProfilePicture(lead.custom_fields);

  const pictureUrl = await provider.fetchProfilePicture(lead.phone);
  const nextFields = {
    ...(lead.custom_fields ?? {}),
    [WHATSAPP_PROFILE_PIC_FETCHED_AT_FIELD]: new Date().toISOString(),
    ...(pictureUrl ? { [WHATSAPP_PROFILE_PIC_URL_FIELD]: pictureUrl } : {}),
  };

  await supabase
    .from("leads")
    .update({ custom_fields: nextFields })
    .eq("id", lead.id)
    .eq("tenant_id", lead.tenant_id);

  return pictureUrl ?? getCachedWhatsAppProfilePicture(nextFields);
}
