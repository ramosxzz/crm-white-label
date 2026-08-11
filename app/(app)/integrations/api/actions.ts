"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey, type ApiScope } from "@/lib/api/auth";
import type { WebhookEvent } from "@/lib/api/webhook-events";

export async function createApiKey(input: { name: string; scopes: ApiScope[] }): Promise<{ key: string }> {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  if (!input.name.trim()) throw new Error("Nome obrigatorio");
  if (input.scopes.length === 0) throw new Error("Selecione ao menos um escopo");

  // As tabelas da API sao deliberadamente privadas (sem policies para o
  // cliente). A action valida usuario, papel e tenant antes de usar o backend.
  const supabase = createServiceClient();
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
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/api");
}

export async function deleteApiKey(id: string) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = createServiceClient();
  const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/api");
}

export async function createWebhookSubscription(input: { url: string; events: WebhookEvent[] }): Promise<{ secret: string }> {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  if (input.events.length === 0) throw new Error("Selecione ao menos um evento");

  const supabase = createServiceClient();
  const secret = randomBytes(24).toString("hex");
  const { error } = await supabase.from("api_webhooks").insert({
    tenant_id: ctx.tenantId,
    url: input.url,
    events: input.events,
    secret,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/integrations/api");
  return { secret };
}

export async function toggleWebhookSubscription(id: string, active: boolean) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = createServiceClient();
  const { error } = await supabase.from("api_webhooks").update({ is_active: active }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/api");
}

export async function deleteWebhookSubscription(id: string) {
  const ctx = await requireContext();
  if (!["owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  const supabase = createServiceClient();
  const { error } = await supabase.from("api_webhooks").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/integrations/api");
}
