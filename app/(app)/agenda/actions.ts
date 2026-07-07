"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canTransitionAppointment } from "@/lib/agenda/status";
import { assertRole, canManageOperationalSetup, canOperateLead } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { requireContext } from "@/lib/tenant";

const uuid = z.string().uuid();
const appointmentSchema = z.object({
  lead_id: uuid.optional(),
  professional_id: uuid.optional(),
  service_id: uuid.optional(),
  starts_at: z.string().min(1),
  duration_minutes: z.number().int().positive(),
  notes: z.string().optional(),
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
    professional_id: formData.get("professional_id") || undefined,
    service_id: formData.get("service_id") || undefined,
    starts_at: formData.get("starts_at"),
    duration_minutes: Number(formData.get("duration_minutes") ?? 60),
    notes: formData.get("notes") || undefined,
  });
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").insert({
    tenant_id: ctx.tenantId,
    lead_id: parsed.lead_id ?? null,
    professional_id: parsed.professional_id ?? null,
    service_id: parsed.service_id ?? null,
    starts_at: new Date(parsed.starts_at).toISOString(),
    duration_minutes: parsed.duration_minutes,
    notes: parsed.notes?.trim() || null,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  refreshAgenda();
}

export async function updateAppointment(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const id = uuid.parse(formData.get("id"));
  const parsed = appointmentSchema.parse({
    lead_id: formData.get("lead_id") || undefined,
    professional_id: formData.get("professional_id") || undefined,
    service_id: formData.get("service_id") || undefined,
    starts_at: formData.get("starts_at"),
    duration_minutes: Number(formData.get("duration_minutes") ?? 60),
    notes: formData.get("notes") || undefined,
  });
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({
    ...parsed,
    lead_id: parsed.lead_id ?? null,
    professional_id: parsed.professional_id ?? null,
    service_id: parsed.service_id ?? null,
    starts_at: new Date(parsed.starts_at).toISOString(),
    notes: parsed.notes?.trim() || null,
  }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshAgenda();
}

export async function transitionAppointmentStatus(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const id = uuid.parse(formData.get("id"));
  const target = z.enum(["confirmed", "completed", "cancelled", "no_show"]).parse(formData.get("status"));
  const supabase = await createClient();
  const { data: appointment } = await supabase.from("appointments").select("status").eq("id", id).eq("tenant_id", ctx.tenantId).single();
  if (!appointment) throw new Error("Horario nao encontrado");
  if (!canTransitionAppointment(appointment.status as AppointmentStatus, target)) {
    throw new Error("Transicao de status invalida");
  }
  const { error } = await supabase.from("appointments").update({ status: target }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
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
  const { error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshAgenda();
  revalidatePath("/reunioes");
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
