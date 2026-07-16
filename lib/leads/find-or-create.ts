import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeInboundContactName } from "@/lib/leads/contact-name";
import { displayLeadName } from "@/lib/leads/display";
import { attachWhatsAppLidToLead, findLeadByContact } from "@/lib/leads/find-by-contact";
import { forwardNewLead } from "@/lib/leads/forward-new-lead";

type SB = SupabaseClient<Database>;

export async function findOrCreateWhatsAppLead(
  supabase: SB,
  tenantId: string,
  contact: {
    phone?: string | null;
    lid?: string | null;
    name?: string | null;
    ignoredNames?: Array<string | null | undefined>;
    stageId?: string | null;
    pipelineId?: string | null;
    referral?: {
      sourceId: string;
      sourceType: string;
      sourceUrl?: string;
      headline?: string;
      body?: string;
      mediaType?: string;
      imageUrl?: string;
      videoUrl?: string;
    } | null;
  },
): Promise<string | null> {
  const existing = await findLeadByContact(supabase, tenantId, {
    phone: contact.phone,
    lid: contact.lid,
  });
  if (existing?.id) {
    if (contact.lid) {
      await attachWhatsAppLidToLead(supabase, existing.id, tenantId, contact.lid);
    }
    if (contact.referral) {
      const currentFields = (existing as any).custom_fields || {};
      if (!currentFields.meta_ad_id) {
        await supabase
          .from("leads")
          .update({
            custom_fields: {
              ...currentFields,
              meta_ad_id: contact.referral.sourceId,
              meta_ad_type: contact.referral.sourceType,
              ...(contact.referral.headline ? { meta_ad_headline: contact.referral.headline } : {}),
              ...(contact.referral.body ? { meta_ad_body: contact.referral.body } : {}),
            }
          })
          .eq("id", existing.id);
      }
    }
    return existing.id;
  }

  const customFields: Record<string, any> = {};
  if (contact.referral) {
    customFields.meta_ad_id = contact.referral.sourceId;
    customFields.meta_ad_type = contact.referral.sourceType;
    if (contact.referral.headline) customFields.meta_ad_headline = contact.referral.headline;
    if (contact.referral.body) customFields.meta_ad_body = contact.referral.body;
  }

  const contactName = normalizeInboundContactName(contact.name, contact.ignoredNames);

  const { data: created, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: tenantId,
      name: displayLeadName(contactName, contact.phone ?? contact.lid ?? ""),
      phone: contact.phone ?? null,
      whatsapp_lid: contact.lid ?? null,
      source: "whatsapp",
      stage_id: contact.stageId ?? null,
      pipeline_id: contact.pipelineId ?? null,
      custom_fields: customFields,
    })
    .select("id")
    .single();

  if (!error && created?.id) {
    // Modo ausente: encaminha o lead novo para o vendedor escolhido, se ativo.
    await forwardNewLead(supabase, tenantId, created.id);
    return created.id;
  }

  const retry = await findLeadByContact(supabase, tenantId, {
    phone: contact.phone,
    lid: contact.lid,
  });
  if (retry?.id) {
    if (contact.lid) {
      await attachWhatsAppLidToLead(supabase, retry.id, tenantId, contact.lid);
    }
    return retry.id;
  }

  return null;
}
