import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { FacebookForm } from "./facebook-form";

export default async function FacebookIntegrationPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("meta_pixel_id, meta_capi_token, meta_ad_account_id, meta_ads_access_token")
    .eq("id", ctx.tenantId)
    .single();

  return (
    <FacebookForm initialData={tenant || {}} />
  );
}
