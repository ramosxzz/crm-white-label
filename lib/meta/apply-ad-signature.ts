import type { SupabaseClient } from "@supabase/supabase-js";
import { matchAdCreative, type AdCreativeSignature } from "@/lib/meta/ad-signature";

/**
 * Grava no lead de qual criativo ele veio, a partir do emoji da mensagem de
 * abertura, quando o referral do Click-to-WhatsApp nao chegou.
 *
 * So roda no primeiro contato: um emoji solto numa conversa ja em andamento
 * nao diz origem nenhuma, e sobrescrever atribuicao com base nisso estragaria
 * o numero de vendas por anuncio.
 *
 * Nunca lanca: isso roda dentro do webhook do WhatsApp, e derrubar o webhook
 * por causa de atribuicao faria perder a mensagem do cliente.
 */

const META_AD_ID_KEYS = [
  "meta_ad_id",
  "meta_source_id",
  "ad_id",
  "source_id",
  "ctwa_ad_id",
  "whatsapp_ad_id",
];

function hasAdAttribution(fields: Record<string, unknown> | null | undefined): boolean {
  if (!fields) return false;
  return META_AD_ID_KEYS.some((key) => {
    const value = fields[key];
    if (typeof value === "string") return value.trim() !== "";
    return value != null;
  });
}

export async function loadAdCreativeSignatures(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<AdCreativeSignature[]> {
  const { data } = await supabase
    .from("ad_creative_signatures")
    .select("id, emoji, match_text, creative_name, ad_id, active")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    emoji: String(row.emoji ?? ""),
    matchText: (row.match_text as string | null) ?? null,
    creativeName: String(row.creative_name ?? ""),
    adId: (row.ad_id as string | null) ?? null,
    active: row.active !== false,
  }));
}

export async function applyAdSignatureToLead(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string,
  body: string | null | undefined,
): Promise<string | null> {
  try {
    if (!body || !body.trim()) return null;

    const { data: lead } = await supabase
      .from("leads")
      .select("custom_fields")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!lead) return null;

    const currentFields = (lead.custom_fields as Record<string, unknown> | null) ?? {};
    // O referral oficial, quando existe, e mais confiavel que o emoji.
    if (hasAdAttribution(currentFields)) return null;

    const rules = await loadAdCreativeSignatures(supabase, tenantId);
    if (rules.length === 0) return null;

    const match = matchAdCreative(rules, body);
    if (!match) return null;

    const nextFields: Record<string, unknown> = {
      ...currentFields,
      meta_creative_name: match.creativeName,
      meta_ad_signature_emoji: match.emoji,
      meta_attribution_source: "emoji_signature",
      meta_referral_captured_at: new Date().toISOString(),
    };
    // So preenche meta_ad_id quando a regra traz o ID real do anuncio: e ele
    // que casa com os insights da Meta no painel. Um valor inventado aqui
    // apareceria como anuncio fantasma no relatorio.
    if (match.adId && match.adId.trim()) {
      nextFields.meta_ad_id = match.adId.trim();
    }

    await supabase
      .from("leads")
      .update({ custom_fields: nextFields })
      .eq("id", leadId)
      .eq("tenant_id", tenantId);

    return match.creativeName;
  } catch (error) {
    console.error("Falha ao atribuir criativo por assinatura:", error);
    return null;
  }
}
