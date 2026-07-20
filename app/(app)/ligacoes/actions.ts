"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { logLeadActivity } from "@/lib/leads/activity-log";
import { CALL_OUTCOME_LABEL, type CallOutcome } from "./call-outcomes";

export async function getLeadCallPanelData(leadId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [{ data: lead }, { data: scheduledMessages }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, notes, tags, value_cents, pipeline_id, stage_id, assigned_to")
      .eq("id", leadId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    supabase
      .from("scheduled_messages")
      .select("id, body, media_url, media_type, send_at, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", leadId)
      .eq("status", "pending")
      .order("send_at", { ascending: true }),
  ]);
  if (!lead) throw new Error("Lead nao encontrado");
  return {
    lead: lead as {
      id: string;
      name: string;
      phone: string | null;
      notes: string | null;
      tags: string[] | null;
      value_cents: number | null;
      pipeline_id: string | null;
      stage_id: string | null;
      assigned_to: string | null;
    },
    scheduledMessages: (scheduledMessages ?? []) as {
      id: string;
      body: string | null;
      media_url: string | null;
      media_type: string | null;
      send_at: string;
      status: string;
    }[],
  };
}

const logCallOutcomeSchema = z.object({
  leadId: z.string().uuid().optional(),
  apiCallId: z.string().optional(),
  outcome: z.enum(["feita", "sem_resposta", "passou_valor", "qualificado", "fechado", "perdido"]),
  notes: z.string().optional(),
});

export async function logCallOutcome(input: {
  leadId?: string;
  apiCallId?: string;
  outcome: CallOutcome;
  notes?: string;
}) {
  const ctx = await requireContext();
  const parsed = logCallOutcomeSchema.parse(input);
  const supabase = await createClient();

  let query = supabase
    .from("call_attempts")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("api4com_call_id", parsed.apiCallId ?? "");
  if (parsed.leadId) query = query.eq("lead_id", parsed.leadId);
  const { data: existing } = parsed.apiCallId ? await query.maybeSingle() : { data: null };

  if (existing) {
    const { error } = await supabase
      .from("call_attempts")
      .update({ outcome: parsed.outcome, notes: parsed.notes?.trim() || null })
      .eq("id", existing.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("call_attempts").insert({
      tenant_id: ctx.tenantId,
      lead_id: parsed.leadId ?? null,
      api4com_call_id: parsed.apiCallId ?? null,
      outcome: parsed.outcome,
      notes: parsed.notes?.trim() || null,
      created_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
  }
  if (parsed.leadId) {
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: parsed.leadId,
      userId: ctx.userId,
      kind: "call_logged",
      payload: { outcome: parsed.outcome, outcome_label: CALL_OUTCOME_LABEL[parsed.outcome] },
    });
  }
  revalidatePath("/ligacoes");
}
