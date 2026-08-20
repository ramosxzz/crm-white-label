"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext, invalidateContextCache } from "@/lib/tenant";

export async function updateTenantInfo(input: {
  name: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
  brand_color?: string;
  stock_enabled?: boolean;
  stock_deduct_on_won?: boolean;
  calls_dashboard_enabled?: boolean;
  field_service_base_address?: string;
}) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();

  // Endereco base mudou: zera o geocode pra ser recalculado na proxima rota.
  const baseAddress = input.field_service_base_address?.trim() || null;
  const baseChanged = baseAddress !== (ctx.tenant.field_service_base_address ?? null);

  // broadcast_enabled e field_service_enabled (ERP W+) sao modulos pagos -
  // de proposito NAO aparecem aqui. So o Ramos ativa via SQL direto, senao
  // qualquer admin de tenant liga sozinho um modulo que ninguem contratou.
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
      stock_deduct_on_won: input.stock_deduct_on_won ?? false,
      calls_dashboard_enabled: input.calls_dashboard_enabled ?? false,
      field_service_base_address: baseAddress,
      ...(baseChanged ? { field_service_base_lat: null, field_service_base_lng: null } : {}),
    })
    .eq("id", ctx.tenantId);
  if (error) throw new Error(error.message);
  // getCurrentContext cacheia o tenant (cor da marca, etc) por 20s em memoria
  // - sem isso, salvar aqui nao aparecia em lugar nenhum ate o cache expirar
  // sozinho, parecendo que a troca de cor nao funciona.
  invalidateContextCache(ctx.userId);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/estoque");
  revalidatePath("/ligacoes");
  revalidatePath("/kanban");
  revalidatePath("/chat");
  revalidatePath("/disparos");
  revalidatePath("/os");
  revalidatePath("/financeiro");
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
  invalidateContextCache(ctx.userId);
  revalidatePath("/", "layout");
}

export async function removeTenantLogo() {
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("tenants").update({ logo_url: null }).eq("id", ctx.tenantId);
  invalidateContextCache(ctx.userId);
  revalidatePath("/", "layout");
}

export async function updateProfile(input: {
  fullName: string;
  jobTitle?: string;
  bio?: string;
  avatarUrl?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      job_title: input.jobTitle?.trim() || null,
      bio: input.bio?.trim() || null,
      ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
    })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function getAvatarPath() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  return user.id;
}

export async function updateApi4comExtension(extension: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nao autenticado");
  const normalizedExtension = extension.replace(/\D/g, "");
  const { error } = await supabase
    .from("profiles")
    .update({ api4com_extension: normalizedExtension || null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateTenantMetaSettings(input: {
  meta_pixel_id?: string;
  meta_capi_token?: string;
  meta_ad_account_id?: string;
  meta_ads_access_token?: string;
}) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();

  const { data: currentTenant, error: currentError } = await supabase
    .from("tenants")
    .select("meta_capi_token, meta_ads_access_token")
    .eq("id", ctx.tenantId)
    .single();
  if (currentError) throw new Error(currentError.message);

  const capiToken = input.meta_capi_token?.trim();
  const adsAccessToken = input.meta_ads_access_token?.trim();
  const adAccountId = normalizeMetaAdAccountId(input.meta_ad_account_id);

  const { error } = await supabase
    .from("tenants")
    .update({
      meta_pixel_id: input.meta_pixel_id?.trim() || null,
      meta_capi_token: capiToken || currentTenant?.meta_capi_token || null,
      meta_ad_account_id: adAccountId,
      meta_ads_access_token: adsAccessToken || currentTenant?.meta_ads_access_token || null,
    })
    .eq("id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations");
  revalidatePath("/integrations/facebook");
  revalidatePath("/dashboard");
}

function normalizeMetaAdAccountId(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  const digits = raw.replace(/^act_/i, "").replace(/\D/g, "");
  return digits || null;
}
