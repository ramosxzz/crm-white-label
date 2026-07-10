"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole, canManageOperationalSetup } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

const idSchema = z.string().uuid();
const pipelineSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio"),
  is_default: z.boolean().default(false),
});
const stageSchema = z.object({
  pipeline_id: idSchema,
  name: z.string().trim().min(1, "Nome obrigatorio"),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Cor invalida"),
});

async function requireSetupContext() {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageOperationalSetup);
  return ctx;
}

function refreshPipelines() {
  revalidatePath("/pipelines");
  revalidatePath("/kanban");
}

export async function createPipeline(formData: FormData) {
  const ctx = await requireSetupContext();
  const parsed = pipelineSchema.parse({
    name: formData.get("name"),
    is_default: formData.get("is_default") === "on",
  });
  const supabase = await createClient();
  if (parsed.is_default) {
    await supabase.from("pipelines").update({ is_default: false }).eq("tenant_id", ctx.tenantId);
  }
  const { error } = await supabase.from("pipelines").insert({ tenant_id: ctx.tenantId, ...parsed });
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function updatePipeline(formData: FormData) {
  const ctx = await requireSetupContext();
  const id = idSchema.parse(formData.get("id"));
  const name = z.string().trim().min(1, "Nome obrigatorio").parse(formData.get("name"));
  const supabase = await createClient();
  const { error } = await supabase.from("pipelines").update({ name }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function setDefaultPipeline(formData: FormData) {
  const ctx = await requireSetupContext();
  const id = idSchema.parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("pipelines").update({ is_default: false }).eq("tenant_id", ctx.tenantId);
  const { error } = await supabase.from("pipelines").update({ is_default: true }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function deletePipeline(formData: FormData) {
  const ctx = await requireSetupContext();
  const id = idSchema.parse(formData.get("id"));
  const supabase = await createClient();
  const { data: pipeline } = await supabase.from("pipelines").select("is_default").eq("id", id).eq("tenant_id", ctx.tenantId).single();
  if (!pipeline) throw new Error("Funil nao encontrado");
  if (pipeline.is_default) throw new Error("Defina outro funil como principal antes de excluir");
  const { error: leadsError } = await supabase
    .from("leads")
    .update({ pipeline_id: null, stage_id: null })
    .eq("pipeline_id", id)
    .eq("tenant_id", ctx.tenantId);
  if (leadsError) throw new Error(leadsError.message);
  const { error: stagesError } = await supabase.from("pipeline_stages").delete().eq("pipeline_id", id).eq("tenant_id", ctx.tenantId);
  if (stagesError) throw new Error(stagesError.message);
  const { error } = await supabase.from("pipelines").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function createStage(formData: FormData) {
  const ctx = await requireSetupContext();
  const parsed = stageSchema.parse({
    pipeline_id: formData.get("pipeline_id"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  const supabase = await createClient();
  const { data: pipeline } = await supabase.from("pipelines").select("id").eq("id", parsed.pipeline_id).eq("tenant_id", ctx.tenantId).single();
  if (!pipeline) throw new Error("Funil nao encontrado");
  const { data: lastStage } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("pipeline_id", parsed.pipeline_id)
    .eq("tenant_id", ctx.tenantId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("pipeline_stages").insert({
    tenant_id: ctx.tenantId,
    pipeline_id: parsed.pipeline_id,
    name: parsed.name,
    color: parsed.color,
    position: (lastStage?.position ?? -1) + 1,
  });
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function updateStage(formData: FormData) {
  const ctx = await requireSetupContext();
  const id = idSchema.parse(formData.get("id"));
  const name = z.string().trim().min(1, "Nome obrigatorio").parse(formData.get("name"));
  const color = z.string().regex(/^#[0-9a-f]{6}$/i, "Cor invalida").parse(formData.get("color"));
  const supabase = await createClient();
  const { error } = await supabase.from("pipeline_stages").update({ name, color }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function moveStage(formData: FormData) {
  const ctx = await requireSetupContext();
  const id = idSchema.parse(formData.get("id"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const supabase = await createClient();
  const { data: current } = await supabase.from("pipeline_stages").select("id, pipeline_id, position").eq("id", id).eq("tenant_id", ctx.tenantId).single();
  if (!current) throw new Error("Etapa nao encontrada");
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, position")
    .eq("pipeline_id", current.pipeline_id)
    .eq("tenant_id", ctx.tenantId)
    .order("position");
  const index = (stages ?? []).findIndex((stage) => stage.id === id);
  const target = stages?.[direction === "up" ? index - 1 : index + 1];
  if (!target) return;
  await supabase.from("pipeline_stages").update({ position: target.position }).eq("id", current.id);
  const { error } = await supabase.from("pipeline_stages").update({ position: current.position }).eq("id", target.id);
  if (error) throw new Error(error.message);
  refreshPipelines();
}

export async function reorderStages(formData: FormData) {
  const ctx = await requireSetupContext();
  const pipelineId = idSchema.parse(formData.get("pipeline_id"));
  const orderedIds = z.array(idSchema).parse(JSON.parse(String(formData.get("ordered_ids") ?? "[]")));
  if (orderedIds.length === 0) return;

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .eq("tenant_id", ctx.tenantId);
  const validIds = new Set((stages ?? []).map((stage) => stage.id));
  if (orderedIds.some((id) => !validIds.has(id)) || orderedIds.length !== validIds.size) {
    throw new Error("Ordem de etapas invalida. Recarregue a pagina e tente novamente.");
  }

  for (const [index, id] of orderedIds.entries()) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: -1000 - index })
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  }
  for (const [position, id] of orderedIds.entries()) {
    const { error } = await supabase.from("pipeline_stages").update({ position }).eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  }
  refreshPipelines();
}

export async function deleteStage(formData: FormData) {
  const ctx = await requireSetupContext();
  const id = idSchema.parse(formData.get("id"));
  const supabase = await createClient();
  const { error: leadsError } = await supabase.from("leads").update({ stage_id: null }).eq("stage_id", id).eq("tenant_id", ctx.tenantId);
  if (leadsError) throw new Error(leadsError.message);
  const { error } = await supabase.from("pipeline_stages").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshPipelines();
}
