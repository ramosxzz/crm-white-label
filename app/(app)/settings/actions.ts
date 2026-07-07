"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function updateTenantInfo(input: {
  name: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
  brand_color?: string;
  stock_enabled?: boolean;
}) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      name: input.name,
      tagline: input.tagline ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      brand_color: input.brand_color ?? null,
      stock_enabled: input.stock_enabled ?? true,
    })
    .eq("id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/estoque");
}

export async function getTenantLogoPath() {
  const ctx = await requireContext();
  return `${ctx.tenantId}`;
}

export async function persistTenantLogoUrl(publicUrl: string, brandColor?: string) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();
  const patch: { logo_url: string; brand_color?: string } = { logo_url: publicUrl };
  if (brandColor?.trim()) patch.brand_color = brandColor.trim();
  const { error } = await supabase.from("tenants").update(patch).eq("id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function removeTenantLogo() {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("tenants").update({ logo_url: null }).eq("id", ctx.tenantId);
  revalidatePath("/", "layout");
}

export async function updateProfileName(fullName: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function updateTenantMetaSettings(input: {
  meta_pixel_id?: string;
  meta_capi_token?: string;
  meta_ad_account_id?: string;
}) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      meta_pixel_id: input.meta_pixel_id?.trim() || null,
      meta_capi_token: input.meta_capi_token?.trim() || null,
      meta_ad_account_id: input.meta_ad_account_id?.trim() || null,
    })
    .eq("id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations");
  revalidatePath("/integrations/facebook");
}
