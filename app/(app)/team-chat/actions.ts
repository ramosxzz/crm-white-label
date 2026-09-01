"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import type { TeamMessageMediaType } from "@/lib/supabase/database.types";

export async function sendTeamMessage(input: {
  body?: string;
  mediaUrl?: string;
  mediaType?: TeamMessageMediaType;
  mentions?: string[];
}) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const body = input.body?.trim() || null;
  if (!body && !input.mediaUrl) throw new Error("Mensagem vazia.");

  const { data, error } = await supabase
    .from("team_messages")
    .insert({
      tenant_id: ctx.tenantId,
      sender_id: ctx.userId,
      body,
      media_url: input.mediaUrl ?? null,
      media_type: input.mediaType ?? null,
      mentions: input.mentions ?? [],
    })
    .select("id, tenant_id, sender_id, body, media_url, media_type, mentions, created_at, edited_at, deleted_at")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/team-chat");
  return data;
}

export async function editTeamMessage(input: { id: string; body: string }) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const body = input.body.trim();
  if (!body) throw new Error("Mensagem vazia.");

  const { error } = await supabase
    .from("team_messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("sender_id", ctx.userId);

  if (error) throw new Error(error.message);
  revalidatePath("/team-chat");
}

export async function deleteTeamMessage(id: string) {
  const ctx = await requireContext();
  const supabase = await createClient();

  // Nao zera body/media_url: a check constraint exige pelo menos um dos dois
  // preenchido. O cliente que esconde o conteudo quando deleted_at existe.
  const { error } = await supabase
    .from("team_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", ctx.userId);

  if (error) throw new Error(error.message);
  revalidatePath("/team-chat");
}
