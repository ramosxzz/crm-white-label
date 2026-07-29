"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageCompanySettings } from "@/lib/auth/roles";
import type { MemberRole } from "@/lib/supabase/database.types";

export type AdSignatureRow = {
  id: string;
  emoji: string;
  match_text: string | null;
  creative_name: string;
  ad_id: string | null;
  active: boolean;
};

function assertCanManage(role: MemberRole) {
  if (!canManageCompanySettings(role)) {
    throw new Error("Sem permissao para gerenciar assinaturas de criativo.");
  }
}

export async function listAdSignatures(): Promise<AdSignatureRow[]> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_creative_signatures")
    .select("id, emoji, match_text, creative_name, ad_id, active")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdSignatureRow[];
}

export async function saveAdSignature(input: {
  id?: string | null;
  emoji: string;
  matchText?: string | null;
  creativeName: string;
  adId?: string | null;
  active?: boolean;
}): Promise<void> {
  const ctx = await requireContext();
  assertCanManage(ctx.role);
  const supabase = await createClient();

  const emoji = input.emoji.trim();
  const creativeName = input.creativeName.trim();
  if (!emoji) throw new Error("Informe o emoji do criativo.");
  if (!creativeName) throw new Error("Informe o nome do criativo.");

  const payload = {
    tenant_id: ctx.tenantId,
    emoji,
    match_text: input.matchText?.trim() ? input.matchText.trim() : null,
    creative_name: creativeName,
    ad_id: input.adId?.trim() ? input.adId.trim() : null,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("ad_creative_signatures")
      .update(payload)
      .eq("id", input.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("ad_creative_signatures").insert(payload);
    if (error) {
      // O indice unico e por (tenant, emoji, texto): duas regras iguais
      // tornariam a atribuicao indeterminada.
      if (error.code === "23505") {
        throw new Error("Ja existe uma regra com esse emoji e esse texto.");
      }
      throw new Error(error.message);
    }
  }

  revalidatePath("/settings");
}

export async function deleteAdSignature(id: string): Promise<void> {
  const ctx = await requireContext();
  assertCanManage(ctx.role);
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_creative_signatures")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

/**
 * Emojis que aparecem nas mensagens de abertura e ainda nao tem regra.
 * Serve pra o time nao precisar caçar criativo novo na mao: assim que um
 * criativo novo comeca a rodar, o emoji dele aparece aqui.
 */
export async function suggestUnmappedEmojis(): Promise<
  Array<{ emoji: string; leads: number; exemplo: string }>
> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("direction", "inbound")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })
    .limit(4000);

  const { extractSignatureEmojis, isMediaPlaceholder } = await import("@/lib/meta/ad-signature");
  const existing = new Set((await listAdSignatures()).map((r) => r.emoji.replace(/[︎️‍]/g, "")));

  const seenConversation = new Set<string>();
  const counts = new Map<string, { leads: number; exemplo: string }>();

  for (const row of (data ?? []) as Array<{ conversation_id: string; body: string | null }>) {
    if (!row.conversation_id || seenConversation.has(row.conversation_id)) continue;
    seenConversation.add(row.conversation_id);
    if (!row.body || isMediaPlaceholder(row.body)) continue;

    for (const emoji of extractSignatureEmojis(row.body)) {
      const key = emoji.replace(/[︎️‍]/g, "");
      if (!key || existing.has(key)) continue;
      const entry = counts.get(key) ?? { leads: 0, exemplo: row.body.slice(0, 80) };
      entry.leads += 1;
      counts.set(key, entry);
    }
  }

  return [...counts.entries()]
    .map(([emoji, v]) => ({ emoji, leads: v.leads, exemplo: v.exemplo }))
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 12);
}
