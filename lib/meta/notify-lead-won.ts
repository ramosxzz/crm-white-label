import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dispara o evento Purchase pro Meta CAPI quando um lead entra numa etapa de
 * ganho. Precisa ser chamado de TODO caminho que pode marcar won_at (kanban,
 * painel do chat, etc) - se algum caminho esquecer de chamar, a venda conta
 * no CRM mas nao e atribuida ao anuncio de origem no Meta.
 */
export async function notifyMetaLeadWon(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string,
  valueCentsOverride?: number | null,
): Promise<void> {
  try {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("phone, email, value_cents, custom_fields")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .single();
    if (!leadRow) return;

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("meta_pixel_id, meta_capi_token")
      .eq("id", tenantId)
      .single();

    const pixelId = tenantRow?.meta_pixel_id || process.env.META_PIXEL_ID;
    const capiToken = tenantRow?.meta_capi_token || process.env.META_CAPI_TOKEN;
    if (!pixelId || !capiToken) return;

    const customFields = (leadRow.custom_fields as Record<string, unknown> | null) ?? {};
    const adId = customFields.meta_ad_id as string | undefined;

    const { sendMetaConversionEvent } = await import("@/lib/meta/meta-capi");
    await sendMetaConversionEvent({
      pixelId,
      accessToken: capiToken,
      eventName: "Purchase",
      phone: leadRow.phone,
      email: leadRow.email,
      valueCents: valueCentsOverride ?? leadRow.value_cents ?? 0,
      adId,
    });
  } catch (e) {
    console.error("Erro ao enviar evento CAPI do Meta:", e);
  }
}
