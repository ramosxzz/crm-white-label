import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeInboundContactName } from "@/lib/leads/contact-name";
import { displayLeadName } from "@/lib/leads/display";
import { attachWhatsAppLidToLead, findLeadByContact } from "@/lib/leads/find-by-contact";
import { forwardNewLead } from "@/lib/leads/forward-new-lead";

type SB = SupabaseClient<Database>;

type ReferralInput = {
  sourceId: string;
  sourceType: string;
  sourceUrl?: string;
  headline?: string;
  body?: string;
  mediaType?: string;
  imageUrl?: string;
  videoUrl?: string;
} | null | undefined;

const META_AD_ID_KEYS = [
  "meta_ad_id",
  "meta_source_id",
  "ad_id",
  "source_id",
  "ctwa_ad_id",
  "whatsapp_ad_id",
];

function hasMetaAdId(fields: Record<string, any>) {
  return META_AD_ID_KEYS.some((key) => {
    const value = fields[key];
    return typeof value === "string" ? Boolean(value.trim()) : value != null;
  });
}

function buildMetaReferralFields(referral: NonNullable<ReferralInput>) {
  return {
    meta_ad_id: referral.sourceId,
    meta_source_id: referral.sourceId,
    meta_source_type: referral.sourceType,
    meta_ad_type: referral.sourceType,
    meta_referral_captured_at: new Date().toISOString(),
    ...(referral.sourceUrl ? { meta_source_url: referral.sourceUrl } : {}),
    ...(referral.headline ? { meta_ad_headline: referral.headline } : {}),
    ...(referral.body ? { meta_ad_body: referral.body } : {}),
    ...(referral.mediaType ? { meta_ad_media_type: referral.mediaType } : {}),
    ...(referral.imageUrl ? { meta_ad_image_url: referral.imageUrl } : {}),
    ...(referral.videoUrl ? { meta_ad_video_url: referral.videoUrl } : {}),
  };
}

function mergeMissingFields(currentFields: Record<string, any>, nextFields: Record<string, any>) {
  const merged = { ...currentFields };
  for (const [key, value] of Object.entries(nextFields)) {
    if (merged[key] == null || merged[key] === "") {
      merged[key] = value;
    }
  }
  return merged;
}

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
    referral?: ReferralInput;
    /** Dono do numero de WhatsApp que recebeu a mensagem (whatsapp_accounts.assigned_to).
     * Vira o responsavel inicial do lead novo, pra tenants com numero por
     * vendedor o cliente ja nascer atribuido a quem realmente vai atender -
     * senao ele fica sem dono e some pro vendedor quando lead_assignment_enabled
     * estiver ligado. */
    receivingAccountOwnerId?: string | null;
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
      const referralFields = buildMetaReferralFields(contact.referral);
      const nextFields = hasMetaAdId(currentFields)
        ? mergeMissingFields(currentFields, referralFields)
        : { ...currentFields, ...referralFields };

      if (JSON.stringify(nextFields) !== JSON.stringify(currentFields)) {
        await supabase
          .from("leads")
          .update({
            custom_fields: nextFields,
          })
          .eq("id", existing.id);
      }
    }
    return existing.id;
  }

  const customFields: Record<string, any> = {};
  if (contact.referral) {
    Object.assign(customFields, buildMetaReferralFields(contact.referral));
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
      assigned_to: contact.receivingAccountOwnerId ?? null,
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
