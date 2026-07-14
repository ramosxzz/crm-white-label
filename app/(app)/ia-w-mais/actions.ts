"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function saveAiAgent(formData: FormData) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const name = String(formData.get("name") || "IA W+").trim() || "IA W+";
  const systemPrompt = String(formData.get("system_prompt") || "").trim();
  const model = String(formData.get("model") || "").trim();

  await supabase
    .from("ai_agents")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        name,
        system_prompt: systemPrompt,
        model: model || null,
      },
      { onConflict: "tenant_id" },
    );

  revalidatePath("/ia-w-mais");
}

export async function toggleAiAgent(enabled: boolean) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("ai_agents")
    .select("id, system_prompt")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (enabled && !existing?.system_prompt?.trim()) {
    return { error: "Escreva a personalidade/instrucoes do agente antes de ativar." };
  }

  await supabase
    .from("ai_agents")
    .upsert({ tenant_id: ctx.tenantId, enabled }, { onConflict: "tenant_id" });

  revalidatePath("/ia-w-mais");
  return { error: null };
}
