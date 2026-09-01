"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { logLeadActivity } from "@/lib/leads/activity-log";
import { canManageOperationalSetup } from "@/lib/auth/roles";
import { CALL_OUTCOME_LABEL, type CallOutcome } from "./call-outcomes";

export type UserDailyGoals = {
  userId: string;
  callsMadeTarget: number;
  callsAnsweredTarget: number;
  meetingsScheduledTarget: number;
  meetingsAttendedTarget: number;
  closedOnCallTarget: number;
  closedLaterTarget: number;
};

export async function listUserDailyGoals(): Promise<UserDailyGoals[]> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_daily_goals")
    .select("*")
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    callsMadeTarget: row.calls_made_target,
    callsAnsweredTarget: row.calls_answered_target,
    meetingsScheduledTarget: row.meetings_scheduled_target,
    meetingsAttendedTarget: row.meetings_attended_target,
    closedOnCallTarget: row.closed_on_call_target,
    closedLaterTarget: row.closed_later_target,
  }));
}

export async function setUserDailyGoals(input: {
  userId: string;
  callsMadeTarget: number;
  callsAnsweredTarget: number;
  meetingsScheduledTarget: number;
  meetingsAttendedTarget: number;
  closedOnCallTarget: number;
  closedLaterTarget: number;
}) {
  const ctx = await requireContext();
  if (!canManageOperationalSetup(ctx.role)) throw new Error("Sem permissao para definir metas");
  const supabase = await createClient();
  const clamp = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  const { error } = await supabase.from("user_daily_goals").upsert(
    {
      tenant_id: ctx.tenantId,
      user_id: input.userId,
      calls_made_target: clamp(input.callsMadeTarget),
      calls_answered_target: clamp(input.callsAnsweredTarget),
      meetings_scheduled_target: clamp(input.meetingsScheduledTarget),
      meetings_attended_target: clamp(input.meetingsAttendedTarget),
      closed_on_call_target: clamp(input.closedOnCallTarget),
      closed_later_target: clamp(input.closedLaterTarget),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/ligacoes");
}

export async function getLeadCallPanelData(leadId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const [{ data: lead }, { data: scheduledMessages }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, notes, tags, value_cents, pipeline_id, stage_id, assigned_to, quality_stars, lost_reason")
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
      quality_stars: number | null;
      lost_reason: string | null;
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

export async function setLeadQualityStars(input: { leadId: string; stars: number }) {
  const ctx = await requireContext();
  const stars = z.number().int().min(0).max(5).parse(input.stars);
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ quality_stars: stars })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  void logLeadActivity(supabase, {
    tenantId: ctx.tenantId,
    leadId: input.leadId,
    userId: ctx.userId,
    kind: "quality_stars_set",
    payload: { stars },
  });
  revalidatePath("/ligacoes");
}

export async function setLeadStage(input: { leadId: string; stageId: string }) {
  const ctx = await requireContext();
  const stageId = z.string().uuid().parse(input.stageId);
  const supabase = await createClient();

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, name, pipeline_id, is_won")
    .eq("id", stageId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!stage) throw new Error("Etapa nao encontrada");

  const { data: lead } = await supabase
    .from("leads")
    .select("stage_id, won_at")
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!lead) throw new Error("Lead nao encontrado");

  const isWon = Boolean((stage as { is_won: boolean }).is_won);
  const wonAtPatch = isWon
    ? lead.stage_id !== stageId
      ? { won_at: new Date().toISOString() }
      : {}
    : { won_at: null };

  const { error } = await supabase
    .from("leads")
    .update({ stage_id: stageId, pipeline_id: stage.pipeline_id, ...wonAtPatch })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  if (wonAtPatch.won_at) {
    const { notifyMetaLeadWon } = await import("@/lib/meta/notify-lead-won");
    void notifyMetaLeadWon(supabase, ctx.tenantId, input.leadId);
  }

  let fromName: string | null = null;
  if (lead.stage_id) {
    const { data: fromStage } = await supabase
      .from("pipeline_stages")
      .select("name")
      .eq("id", lead.stage_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    fromName = (fromStage as { name?: string | null } | null)?.name ?? null;
  }
  void logLeadActivity(supabase, {
    tenantId: ctx.tenantId,
    leadId: input.leadId,
    userId: ctx.userId,
    kind: "stage_changed",
    payload: { from_stage_name: fromName, to_stage_name: stage.name },
  });
  revalidatePath("/ligacoes");
}

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
