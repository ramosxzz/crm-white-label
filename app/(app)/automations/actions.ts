"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function createFlow(formData: FormData) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!name) return;

  const { data: flow } = await supabase
    .from("automation_flows")
    .insert({
      tenant_id: ctx.tenantId,
      name,
      description: description || null,
      trigger_kind: null,
      status: "draft",
    })
    .select("id")
    .single();

  if (!flow) return;

  // Comeca em branco: usuario monta o fluxo livremente no editor,
  // escolhendo o gatilho (e qualquer outro bloco) quando quiser.
  await supabase.from("automation_versions").insert({
    flow_id: flow.id,
    tenant_id: ctx.tenantId,
    version_number: 1,
    config: { blocks: [], connections: [] },
  });

  revalidatePath("/automations");
  redirect(`/automations/${flow.id}/editor`);
}

// Salva o rascunho do fluxo continuamente (autosave), sem publicar nem mudar
// o status. Garante que o trabalho no editor nao se perca ao atualizar a pagina.
export async function saveFlowDraft(
  flowId: string,
  config: { blocks: { type?: string; data?: { kind?: string } }[]; connections: unknown[] },
): Promise<{ ok: boolean }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  const triggerBlock = config.blocks.find((b) => b.type === "trigger");
  const triggerKind = triggerBlock?.data?.kind ?? null;

  const { data: latest } = await supabase
    .from("automation_versions")
    .select("id, version_number, published_at")
    .eq("flow_id", flowId)
    .eq("tenant_id", ctx.tenantId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestRow = latest as { id: string; version_number: number; published_at: string | null } | null;

  if (latestRow && !latestRow.published_at) {
    // Ja existe um rascunho: atualiza no lugar.
    const { error } = await supabase
      .from("automation_versions")
      .update({ config })
      .eq("id", latestRow.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { ok: false };
  } else {
    // Ultima versao ja publicada (ou nenhuma): cria um novo rascunho.
    const nextVersion = (latestRow?.version_number ?? 0) + 1;
    const { error } = await supabase.from("automation_versions").insert({
      flow_id: flowId,
      tenant_id: ctx.tenantId,
      version_number: nextVersion,
      config,
    });
    if (error) return { ok: false };
  }

  // Mantem o gatilho do fluxo em dia (para poder ativar), sem mexer no status.
  await supabase
    .from("automation_flows")
    .update({ trigger_kind: triggerKind })
    .eq("id", flowId)
    .eq("tenant_id", ctx.tenantId);

  return { ok: true };
}

export async function updateFlowStatus(flowId: string, status: "draft" | "active" | "paused") {
  const ctx = await requireContext();
  const supabase = await createClient();

  if (status === "active") {
    const { data: flow } = await supabase
      .from("automation_flows")
      .select("trigger_kind")
      .eq("id", flowId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!flow?.trigger_kind) return; // sem gatilho no fluxo, nao ha o que ativar
  }

  await supabase
    .from("automation_flows")
    .update({ status })
    .eq("id", flowId)
    .eq("tenant_id", ctx.tenantId);

  revalidatePath("/automations");
  revalidatePath(`/automations/${flowId}/editor`);
}

export async function deleteFlow(flowId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();

  await supabase
    .from("automation_flows")
    .delete()
    .eq("id", flowId)
    .eq("tenant_id", ctx.tenantId);

  revalidatePath("/automations");
  redirect("/automations");
}

export async function saveFlowVersion(
  flowId: string,
  config: { blocks: { type?: string; data?: { kind?: string } }[]; connections: unknown[] },
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireContext();
  const supabase = await createClient();

  // O gatilho e o que o usuario colocou no canvas, nao uma escolha travada na criacao
  const triggerBlock = config.blocks.find((b) => b.type === "trigger");
  const triggerKind = triggerBlock?.data?.kind ?? null;

  // Get latest version number
  const { data: latest } = await supabase
    .from("automation_versions")
    .select("version_number")
    .eq("flow_id", flowId)
    .eq("tenant_id", ctx.tenantId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest as { version_number?: number } | null)?.version_number ?? 0) + 1;

  await supabase.from("automation_versions").insert({
    flow_id: flowId,
    tenant_id: ctx.tenantId,
    version_number: nextVersion,
    config,
    published_at: new Date().toISOString(),
  });

  // So ativa se houver um gatilho no fluxo; sem gatilho o fluxo fica salvo como rascunho
  await supabase
    .from("automation_flows")
    .update({ trigger_kind: triggerKind, status: triggerKind ? "active" : "draft" })
    .eq("id", flowId)
    .eq("tenant_id", ctx.tenantId);

  revalidatePath(`/automations/${flowId}/editor`);
  revalidatePath("/automations");

  return triggerKind
    ? { ok: true }
    : { ok: false, error: "Adicione um bloco de gatilho ao fluxo para poder ativa-lo." };
}
