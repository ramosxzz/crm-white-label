"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { QUICK_MESSAGE_PRESETS } from "@/lib/quick-messages/presets";
import type { QuickMessage } from "@/lib/supabase/database.types";

export async function ensureQuickMessagesSeeded(): Promise<QuickMessage[]> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("quick_messages_seeded_at")
    .eq("id", ctx.tenantId)
    .single();

  const { data: existing, error } = await supabase
    .from("quick_messages")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  // Ja foi semeado antes (mesmo que o tenant tenha apagado tudo depois) -> nunca reseeda
  if ((tenant as { quick_messages_seeded_at?: string | null } | null)?.quick_messages_seeded_at) {
    return (existing ?? []) as QuickMessage[];
  }
  if (existing && existing.length > 0) {
    await supabase
      .from("tenants")
      .update({ quick_messages_seeded_at: new Date().toISOString() })
      .eq("id", ctx.tenantId)
      .is("quick_messages_seeded_at", null);
    return existing as QuickMessage[];
  }

  const rows = QUICK_MESSAGE_PRESETS.map((p, i) => ({
    tenant_id: ctx.tenantId,
    title: p.title,
    body: p.body,
    sort_order: i,
    is_preset: true,
  }));
  const { data: inserted, error: insErr } = await supabase
    .from("quick_messages")
    .insert(rows)
    .select("*");
  if (insErr) throw new Error(insErr.message);

  await supabase
    .from("tenants")
    .update({ quick_messages_seeded_at: new Date().toISOString() })
    .eq("id", ctx.tenantId);

  return (inserted ?? []) as QuickMessage[];
}

export async function listQuickMessages(): Promise<QuickMessage[]> {
  return ensureQuickMessagesSeeded();
}

export async function createQuickMessage(input: {
  title: string;
  body?: string;
  media_url?: string;
  media_type?: string;
}) {
  const ctx = await requireContext();
  const title = input.title.trim();
  const body = (input.body ?? "").trim();
  const mediaUrl = input.media_url?.trim() || null;
  if (!title) throw new Error("Titulo e obrigatorio");
  if (!body && !mediaUrl) throw new Error("Informe uma mensagem ou um audio");

  const supabase = await createClient();
  const { count } = await supabase
    .from("quick_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId);
  const sortOrder = count ?? 0;

  // Devolve a linha criada pra tela inserir na lista sem recarregar a pagina.
  const { data: created, error } = await supabase
    .from("quick_messages")
    .insert({
      tenant_id: ctx.tenantId,
      title,
      body: body || null,
      media_url: mediaUrl,
      media_type: mediaUrl ? input.media_type ?? "audio" : null,
      sort_order: sortOrder,
      is_preset: false,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("tenants")
    .update({ quick_messages_seeded_at: new Date().toISOString() })
    .eq("id", ctx.tenantId)
    .is("quick_messages_seeded_at", null);
  revalidatePath("/settings");
  revalidatePath("/mensagens-rapidas");
  revalidatePath("/chat", "layout");
  return created as QuickMessage;
}

export async function updateQuickMessage(input: {
  id: string;
  title: string;
  body: string;
}) {
  const ctx = await requireContext();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("Titulo e obrigatorio");

  const supabase = await createClient();
  const { error } = await supabase
    .from("quick_messages")
    .update({ title, body: body || null, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/mensagens-rapidas");
  revalidatePath("/chat", "layout");
}

export async function deleteQuickMessage(id: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("quick_messages")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/mensagens-rapidas");
  revalidatePath("/chat", "layout");
}

export async function reorderQuickMessages(orderedIds: string[]) {
  const ctx = await requireContext();
  if (orderedIds.length === 0) return;

  const supabase = await createClient();
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("quick_messages")
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath("/settings");
  revalidatePath("/mensagens-rapidas");
  revalidatePath("/chat", "layout");
}

export async function addPresetQuickMessage(presetIndex: number) {
  const ctx = await requireContext();
  const preset = QUICK_MESSAGE_PRESETS[presetIndex];
  if (!preset) throw new Error("Modelo invalido");

  const supabase = await createClient();
  const { data: dup } = await supabase
    .from("quick_messages")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("title", preset.title)
    .eq("body", preset.body)
    .maybeSingle();
  if (dup) throw new Error("Este modelo ja esta na sua lista");

  const { count } = await supabase
    .from("quick_messages")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId);

  const { data: created, error } = await supabase
    .from("quick_messages")
    .insert({
      tenant_id: ctx.tenantId,
      title: preset.title,
      body: preset.body,
      sort_order: count ?? 0,
      is_preset: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("tenants")
    .update({ quick_messages_seeded_at: new Date().toISOString() })
    .eq("id", ctx.tenantId)
    .is("quick_messages_seeded_at", null);
  revalidatePath("/settings");
  revalidatePath("/mensagens-rapidas");
  revalidatePath("/chat", "layout");
  return created as QuickMessage;
}
