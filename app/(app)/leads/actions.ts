"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canOperateLead, assertRole } from "@/lib/auth/roles";
import { chooseRoundRobinAttendant } from "@/lib/leads/assignment";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { normalizePhone } from "@/lib/utils";
import { fireAutomationTrigger } from "@/lib/automations/trigger";

const leadSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  notes: z.string().optional(),
  stage_id: z.string().uuid().optional(),
  value_cents: z.number().int().min(0).optional(),
});

export async function createLead(formData: FormData) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const parsed = leadSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    source: formData.get("source") || undefined,
    notes: formData.get("notes") || undefined,
    stage_id: formData.get("stage_id") || undefined,
    value_cents: formData.get("value_cents")
      ? Math.round(Number(formData.get("value_cents")) * 100)
      : 0,
  });

  let stageId = parsed.stage_id;
  if (!stageId) {
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id, pipeline_stages(id, position)")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_default", true)
      .single();
    const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
      ?.pipeline_stages?.sort((a, b) => a.position - b.position);
    stageId = stages?.[0]?.id;
  }

  const { data: pipelineRow } = await supabase
    .from("pipeline_stages")
    .select("pipeline_id")
    .eq("id", stageId!)
    .single();

  const { data: createdLead, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: ctx.tenantId,
      name: parsed.name,
      phone: parsed.phone ? normalizePhone(parsed.phone) : null,
      email: parsed.email || null,
      source: parsed.source || null,
      notes: parsed.notes || null,
      stage_id: stageId,
      pipeline_id: pipelineRow?.pipeline_id,
      value_cents: parsed.value_cents ?? 0,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (createdLead) {
    if (parsed.value_cents && parsed.value_cents > 0) {
      await supabase.from("lead_value_items").insert({
        tenant_id: ctx.tenantId,
        lead_id: createdLead.id,
        label: "Valor inicial",
        amount_cents: parsed.value_cents,
        created_by: ctx.userId,
      });
    }
    try {
      await autoAssignLead(createdLead.id);
    } catch (assignmentError) {
      console.error("Erro ao distribuir lead automaticamente:", assignmentError);
    }
    void fireAutomationTrigger(ctx.tenantId, "lead_created", createdLead.id, {
      source: parsed.source,
    });
  }

  revalidatePath("/leads");
  revalidatePath("/kanban");
}

export async function updateLead(id: string, patch: Partial<{
  name: string;
  phone: string;
  email: string;
  source: string;
  notes: string;
  stage_id: string;
  value_cents: number;
  position: number;
}>) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const data = { ...patch };
  if (data.phone) data.phone = normalizePhone(data.phone);

  const { error } = await supabase
    .from("leads")
    .update(data)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);

  if (error) throw new Error(error.message);

  if (patch.stage_id) {
    try {
      const { data: stageRow } = await supabase
        .from("pipeline_stages")
        .select("is_won")
        .eq("id", patch.stage_id)
        .eq("tenant_id", ctx.tenantId)
        .single();

      if (stageRow?.is_won) {
        const { data: leadRow } = await supabase
          .from("leads")
          .select("phone, email, value_cents, custom_fields")
          .eq("id", id)
          .eq("tenant_id", ctx.tenantId)
          .single();

        if (leadRow) {
          const { data: tenantRow } = await supabase
            .from("tenants")
            .select("meta_pixel_id, meta_capi_token")
            .eq("id", ctx.tenantId)
            .single();

          const pixelId = tenantRow?.meta_pixel_id || process.env.META_PIXEL_ID;
          const capiToken = tenantRow?.meta_capi_token || process.env.META_CAPI_TOKEN;
          const customFields = (leadRow as any).custom_fields || {};
          const adId = customFields.meta_ad_id;

          if (pixelId && capiToken) {
            const { sendMetaConversionEvent } = await import("@/lib/meta/meta-capi");
            await sendMetaConversionEvent({
              pixelId,
              accessToken: capiToken,
              eventName: "Purchase",
              phone: leadRow.phone,
              email: leadRow.email,
              valueCents: patch.value_cents ?? leadRow.value_cents ?? 0,
              adId: adId,
            });
          }
        }
      }
    } catch (e) {
      console.error("Erro ao enviar evento CAPI do Meta:", e);
    }
  }

  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath(`/leads/${id}`);
}

export async function moveLeadToStage(leadId: string, stageId: string, position: number) {
  const ctx = await requireContext();
  await updateLead(leadId, { stage_id: stageId, position });
  void fireAutomationTrigger(ctx.tenantId, "stage_changed", leadId, { stage_id: stageId });
}

export async function assignLead(input: {
  leadId: string;
  toUserId: string | null;
  reason: "round_robin" | "manual_assign" | "transfer" | "return_to_queue";
}) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!lead) throw new Error("Lead nao encontrado");

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: input.toUserId })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  const { error: historyError } = await supabase.from("lead_assignment_history").insert({
    tenant_id: ctx.tenantId,
    lead_id: input.leadId,
    from_user_id: lead.assigned_to,
    to_user_id: input.toUserId,
    assigned_by: ctx.userId,
    reason: input.reason,
  });
  if (historyError) throw new Error(historyError.message);

  revalidatePath("/leads");
  revalidatePath("/kanban");
}

export async function autoAssignLead(leadId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: attendants, error } = await supabase
    .from("attendant_status")
    .select("user_id, is_available, last_assigned_at")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_available", true);
  if (error) throw new Error(error.message);

  const selected = chooseRoundRobinAttendant(attendants ?? []);
  if (!selected) return null;

  await assignLead({ leadId, toUserId: selected.user_id, reason: "round_robin" });
  const { error: statusError } = await supabase
    .from("attendant_status")
    .update({ last_assigned_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId)
    .eq("user_id", selected.user_id);
  if (statusError) throw new Error(statusError.message);
  return selected.user_id;
}

export async function deleteLead(id: string) {
  const ctx = await requireContext();
  if (ctx.role === "vendedor") throw new Error("Sem permissao para excluir leads");
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/kanban");
  revalidatePath("/chat");
}

export async function importLeadsCSV(rows: Array<{ name: string; phone?: string; email?: string; source?: string }>) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_default", true)
    .single();
  const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
    ?.pipeline_stages?.sort((a, b) => a.position - b.position);
  const stageId = stages?.[0]?.id;
  const pipelineId = (pipeline as { id?: string } | null)?.id;

  const inserts = rows
    .filter((r) => r.name?.trim())
    .map((r) => ({
      tenant_id: ctx.tenantId,
      name: r.name.trim(),
      phone: r.phone ? normalizePhone(r.phone) : null,
      email: r.email?.trim() || null,
      source: r.source?.trim() || "csv-import",
      stage_id: stageId,
      pipeline_id: pipelineId,
    }));

  if (inserts.length === 0) return { count: 0 };
  const { data: createdLeads, error, count } = await supabase.from("leads").insert(inserts, { count: "exact" }).select("id");
  if (error) throw new Error(error.message);
  for (const lead of createdLeads ?? []) {
    try {
      await autoAssignLead(lead.id);
    } catch (assignmentError) {
      console.error("Erro ao distribuir lead importado automaticamente:", assignmentError);
    }
  }
  revalidatePath("/leads");
  revalidatePath("/kanban");
  return { count: count ?? inserts.length };
}
