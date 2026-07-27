"use server";

import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey, type ApiScope } from "@/lib/api/auth";

export async function createApiKey(input: { name: string; scopes: ApiScope[] }): Promise<{ key: string }> {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  if (!input.name.trim()) throw new Error("Nome obrigatorio");
  if (input.scopes.length === 0) throw new Error("Selecione ao menos um escopo");

  const supabase = await createClient();
  const { key, prefix } = generateApiKey();

  const { error } = await supabase.from("api_keys").insert({
    tenant_id: ctx.tenantId,
    name: input.name.trim(),
    key_prefix: prefix,
    key_hash: hashApiKey(key),
    scopes: input.scopes,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/integrations/api");
  return { key };
}

export async function revokeApiKey(id: string) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();
  await supabase
    .from("api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath("/integrations/api");
}

export async function deleteApiKey(id: string) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = await createClient();
  await supabase.from("api_keys").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  revalidatePath("/integrations/api");
}
