"use server";

import { revalidatePath } from "next/cache";
import { canOperateLead, assertRole } from "@/lib/auth/roles";
import { normalizeCustomFieldValues } from "@/lib/leads/custom-fields";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function updateTechnicalProfile(leadId: string, values: Record<string, unknown>) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const supabase = await createClient();
  const [{ data: definitions }, { data: lead }] = await Promise.all([
    supabase
      .from("custom_field_definitions")
      .select("key, field_type, is_required")
      .eq("tenant_id", ctx.tenantId)
      .eq("entity_type", "lead")
      .order("sort_order"),
    supabase
      .from("leads")
      .select("custom_fields")
      .eq("id", leadId)
      .eq("tenant_id", ctx.tenantId)
      .single(),
  ]);
  if (!lead) throw new Error("Lead nao encontrado");

  const normalized = normalizeCustomFieldValues(definitions ?? [], values);
  const customFields = {
    ...((lead.custom_fields ?? {}) as Record<string, unknown>),
    ...normalized,
  };
  const { error } = await supabase
    .from("leads")
    .update({ custom_fields: customFields })
    .eq("id", leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  await supabase.from("lead_activities").insert({
    tenant_id: ctx.tenantId,
    lead_id: leadId,
    user_id: ctx.userId,
    kind: "technical_profile_updated",
    payload: normalized,
  });
  revalidatePath(`/leads/${leadId}`);
}

export async function createLeadTask(input: {
  leadId: string;
  title: string;
  notes?: string;
  dueAt?: string;
  assignedTo?: string;
}) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const supabase = await createClient();
  const title = input.title.trim();
  if (!title) throw new Error("Titulo obrigatorio");
  const { error } = await supabase.from("tasks").insert({
    tenant_id: ctx.tenantId,
    lead_id: input.leadId,
    assigned_to: input.assignedTo || ctx.userId,
    created_by: ctx.userId,
    title,
    notes: input.notes?.trim() || null,
    due_at: input.dueAt || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${input.leadId}`);
}

export async function addLeadNote(input: { leadId: string; text: string }) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const text = input.text.trim();
  if (!text) throw new Error("Nota vazia");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({
    tenant_id: ctx.tenantId,
    lead_id: input.leadId,
    user_id: ctx.userId,
    kind: "note",
    payload: { text },
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${input.leadId}`);
}

export async function completeLeadTask(taskId: string, leadId: string) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("lead_id", leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${leadId}`);
}
