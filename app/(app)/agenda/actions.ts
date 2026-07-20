"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canTransitionAppointment } from "@/lib/agenda/status";
import { notifyAppointmentAssignee } from "@/lib/agenda/appointment-notifications";
import { assertRole, canManageOperationalSetup, canOperateLead } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { requireContext } from "@/lib/tenant";
import { logLeadActivity } from "@/lib/leads/activity-log";

const uuid = z.string().uuid();
const appointmentSchema = z.object({
  lead_id: uuid.optional(),
  assigned_to: uuid.optional(),
  professional_id: uuid.optional(),
  service_id: uuid.optional(),
  starts_at: z.string().min(1),
  duration_minutes: z.number().int().positive(),
  notes: z.string().optional(),
  kind: z.enum(["meeting", "call"]).default("meeting"),
});

function refreshAgenda() {
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

export async function createAppointment(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const parsed = appointmentSchema.parse({
    lead_id: formData.get("lead_id") || undefined,
    assigned_to: formData.get("assigned_to") || undefined,
    professional_id: formData.get("professional_id") || undefined,
    service_id: formData.get("service_id") || undefined,
    starts_at: formData.get("starts_at"),
    duration_minutes: Number(formData.get("duration_minutes") ?? 60),
    notes: formData.get("notes") || undefined,
    kind: formData.get("kind") || undefined,
  });
  const supabase = await createClient();
  const startsAtIso = new Date(parsed.starts_at).toISOString();
  const { data: lead } = parsed.lead_id
    ? await supabase
        .from("leads")
        .select("name")
        .eq("id", parsed.lead_id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle()
    : { data: null };
  const { error } = await supabase.from("appointments").insert({
    tenant_id: ctx.tenantId,
    lead_id: parsed.lead_id ?? null,
    assigned_to: parsed.assigned_to ?? null,
    professional_id: parsed.professional_id ?? null,
    service_id: parsed.service_id ?? null,
    starts_at: startsAtIso,
    duration_minutes: parsed.duration_minutes,
    notes: parsed.notes?.trim() || null,
    kind: parsed.kind,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  if (parsed.lead_id) {
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId: parsed.lead_id,
      userId: ctx.userId,
      kind: parsed.kind === "call" ? "call_scheduled" : "meeting_scheduled",
      payload: { starts_at: startsAtIso },
    });
  }
  await notifyAppointmentAssignee(supabase, {
    tenantId: ctx.tenantId,
    assigneeId: parsed.assigned_to,
    leadId: parsed.lead_id,
    leadName: lead?.name ?? null,
    startsAtIso,
  });
  refreshAgenda();
}

const scheduleCallSchema = z.object({
  lead_id: uuid,
  starts_at: z.string().min(1),
  notes: z.string().optional(),
});

export async function scheduleCall(input: { leadId: string; startsAt: string; notes?: string }) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const parsed = scheduleCallSchema.parse({
    lead_id: input.leadId,
    starts_at: input.startsAt,
    notes: input.notes,
  });
  const supabase = await createClient();
  const startsAtIso = new Date(parsed.starts_at).toISOString();
  const { data: lead } = await supabase
    .from("leads")
    .select("name, assigned_to")
    .eq("id", parsed.lead_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!lead) throw new Error("Lead nao encontrado");
  const { error } = await supabase.from("appointments").insert({
    tenant_id: ctx.tenantId,
    lead_id: parsed.lead_id,
    assigned_to: lead.assigned_to ?? null,
    starts_at: startsAtIso,
    duration_minutes: 15,
    notes: parsed.notes?.trim() || null,
    kind: "call",
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  void logLeadActivity(supabase, {
    tenantId: ctx.tenantId,
    leadId: parsed.lead_id,
    userId: ctx.userId,
    kind: "call_scheduled",
    payload: { starts_at: startsAtIso },
  });
  await notifyAppointmentAssignee(supabase, {
    tenantId: ctx.tenantId,
    assigneeId: lead.assigned_to,
    leadId: parsed.lead_id,
    leadName: lead.name ?? null,
    startsAtIso,
  });
  refreshAgenda();
  revalidatePath("/ligacoes");
}

export async function updateAppointment(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const id = uuid.parse(formData.get("id"));
  const parsed = appointmentSchema.parse({
    lead_id: formData.get("lead_id") || undefined,
    assigned_to: formData.get("assigned_to") || undefined,
    professional_id: formData.get("professional_id") || undefined,
    service_id: formData.get("service_id") || undefined,
    starts_at: formData.get("starts_at"),
    duration_minutes: Number(formData.get("duration_minutes") ?? 60),
    notes: formData.get("notes") || undefined,
    kind: formData.get("kind") || undefined,
  });
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("appointments")
    .select("assigned_to")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  const startsAtIso = new Date(parsed.starts_at).toISOString();
  const { data: lead } = parsed.lead_id
    ? await supabase
        .from("leads")
        .select("name")
        .eq("id", parsed.lead_id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle()
    : { data: null };
  const { error } = await supabase.from("appointments").update({
    ...parsed,
    lead_id: parsed.lead_id ?? null,
    assigned_to: parsed.assigned_to ?? null,
    professional_id: parsed.professional_id ?? null,
    service_id: parsed.service_id ?? null,
    starts_at: startsAtIso,
    notes: parsed.notes?.trim() || null,
  }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  if (parsed.assigned_to && parsed.assigned_to !== current?.assigned_to) {
    await notifyAppointmentAssignee(supabase, {
      tenantId: ctx.tenantId,
      assigneeId: parsed.assigned_to,
      leadId: parsed.lead_id,
      leadName: lead?.name ?? null,
      startsAtIso,
    });
  }
  refreshAgenda();
}

export async function transitionAppointmentStatus(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const id = uuid.parse(formData.get("id"));
  const target = z.enum(["confirmed", "completed", "cancelled", "no_show"]).parse(formData.get("status"));
  const supabase = await createClient();
  const { data: appointment } = await supabase.from("appointments").select("status, lead_id, kind").eq("id", id).eq("tenant_id", ctx.tenantId).single();
  if (!appointment) throw new Error("Horario nao encontrado");
  if (!canTransitionAppointment(appointment.status as AppointmentStatus, target)) {
    throw new Error("Transicao de status invalida");
  }
  const { error } = await supabase.from("appointments").update({ status: target }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  const leadId = (appointment as { lead_id: string | null }).lead_id;
  if (leadId) {
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId,
      userId: ctx.userId,
      kind: (appointment as { kind?: string }).kind === "call" ? "call_status_changed" : "meeting_status_changed",
      payload: { status: target },
    });
  }
  refreshAgenda();
}

export async function setMeetingOutcome(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const id = uuid.parse(formData.get("id"));
  const outcome = z
    .enum(["pending", "no_show", "done", "closed_on_call", "closed_later"])
    .parse(formData.get("outcome"));
  const dealValue = Number(formData.get("deal_value") ?? 0);
  const cost = Number(formData.get("cost") ?? 0);

  const isClose = outcome === "closed_on_call" || outcome === "closed_later";
  const newStatus =
    outcome === "no_show" ? "no_show" : outcome === "pending" ? "scheduled" : "completed";

  const update: Record<string, unknown> = {
    outcome,
    status: newStatus,
    cost_cents: Number.isFinite(cost) ? Math.round(cost * 100) : 0,
  };
  if (isClose) {
    update.deal_value_cents = Number.isFinite(dealValue) ? Math.round(dealValue * 100) : 0;
    update.closed_at = new Date().toISOString();
  } else {
    update.deal_value_cents = 0;
    update.closed_at = null;
  }

  const supabase = await createClient();
  const { data: appointment } = await supabase.from("appointments").select("lead_id, kind").eq("id", id).eq("tenant_id", ctx.tenantId).maybeSingle();
  const { error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  const leadId = (appointment as { lead_id: string | null } | null)?.lead_id;
  if (leadId) {
    void logLeadActivity(supabase, {
      tenantId: ctx.tenantId,
      leadId,
      userId: ctx.userId,
      kind: (appointment as { kind?: string } | null)?.kind === "call" ? "call_outcome" : "meeting_outcome",
      payload: { outcome },
    });
  }
  refreshAgenda();
  revalidatePath("/reunioes");
}

export async function listScheduledMessagesForTenant() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("scheduled_messages")
    .select("id, lead_id, body, media_url, media_type, send_at, status, leads(id, name, phone)")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "pending")
    .order("send_at", { ascending: true });
  return (data ?? []) as {
    id: string;
    lead_id: string;
    body: string | null;
    media_url: string | null;
    media_type: string | null;
    send_at: string;
    status: string;
    leads: { id: string; name: string; phone: string | null } | null;
  }[];
}

export async function createProfessional(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageOperationalSetup);
  const name = z.string().trim().min(1, "Nome obrigatorio").parse(formData.get("name"));
  const phone = z.string().trim().optional().parse(formData.get("phone") || undefined);
  const supabase = await createClient();
  const { error } = await supabase.from("professionals").insert({ tenant_id: ctx.tenantId, name, phone: phone || null });
  if (error) throw new Error(error.message);
  refreshAgenda();
}

export async function createService(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canManageOperationalSetup);
  const parsed = z.object({
    name: z.string().trim().min(1, "Nome obrigatorio"),
    duration_minutes: z.number().int().positive(),
    price: z.number().min(0),
  }).parse({
    name: formData.get("name"),
    duration_minutes: Number(formData.get("duration_minutes") ?? 60),
    price: Number(formData.get("price") ?? 0),
  });
  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    tenant_id: ctx.tenantId,
    name: parsed.name,
    duration_minutes: parsed.duration_minutes,
    price_cents: Math.round(parsed.price * 100),
  });
  if (error) throw new Error(error.message);
  refreshAgenda();
}
