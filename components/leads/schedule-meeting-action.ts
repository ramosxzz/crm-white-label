"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyAppointmentAssignee } from "@/lib/agenda/appointment-notifications";
import { assertRole, canOperateLead } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { listTenantUserOptions } from "@/lib/tenant/users";

const uuid = z.string().uuid();

export type MeetingDayAvailability = {
  userId: string;
  userName: string;
  busy: Array<{ startAt: string; endAt: string; leadName: string }>;
};

/**
 * Agenda do dia por responsavel, pra vendedora ver o horario ja ocupado
 * antes de marcar reuniao com o lead - hoje o form de agendar reuniao
 * insere cego, sem checar conflito nenhum. Mesma ideia do MiniAgenda de
 * tecnicos (app/(app)/os/mini-agenda.tsx + getTechnicianDayAvailability),
 * so que em cima de `appointments` (reuniao/ligacao), nao `service_orders`.
 */
export async function getMeetingDayAvailability(day: string): Promise<MeetingDayAvailability[]> {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Data invalida");

  const supabase = await createClient();
  const users = await listTenantUserOptions(ctx.tenantId);
  if (users.length === 0) return [];

  const dayStart = new Date(`${day}T00:00:00-03:00`).toISOString();
  const dayEnd = new Date(`${day}T23:59:59.999-03:00`).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("assigned_to, starts_at, duration_minutes, status, leads(name)")
    .eq("tenant_id", ctx.tenantId)
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd)
    .not("status", "in", "(cancelled)")
    .not("assigned_to", "is", null);
  if (error) throw new Error(error.message);

  const rows = (appointments ?? []) as Array<{
    assigned_to: string | null;
    starts_at: string;
    duration_minutes: number;
    leads: { name: string | null } | null;
  }>;

  const busyByUser = new Map<string, MeetingDayAvailability["busy"]>();
  for (const row of rows) {
    if (!row.assigned_to) continue;
    const startAt = row.starts_at;
    const endAt = new Date(new Date(startAt).getTime() + row.duration_minutes * 60_000).toISOString();
    const list = busyByUser.get(row.assigned_to) ?? [];
    list.push({ startAt, endAt, leadName: row.leads?.name ?? "Lead" });
    busyByUser.set(row.assigned_to, list);
  }

  return users.map((user) => ({
    userId: user.id,
    userName: user.name,
    busy: (busyByUser.get(user.id) ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt)),
  }));
}

export async function createAppointmentForLead(formData: FormData) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);

  const parsed = z
    .object({
      lead_id: uuid,
      assigned_to: uuid.optional(),
      lead_name: z.string().optional(),
      professional_id: uuid.optional(),
      service_id: uuid.optional(),
      starts_at: z.string().min(1),
      duration_minutes: z.number().int().positive(),
      notes: z.string().optional(),
    })
    .parse({
      lead_id: formData.get("lead_id"),
      assigned_to: formData.get("assigned_to") || undefined,
      lead_name: formData.get("lead_name") || undefined,
      professional_id: formData.get("professional_id") || undefined,
      service_id: formData.get("service_id") || undefined,
      starts_at: formData.get("starts_at"),
      duration_minutes: Number(formData.get("duration_minutes") ?? 60),
      notes: formData.get("notes") || undefined,
    });

  const supabase = await createClient();
  const startsAtIso = new Date(parsed.starts_at).toISOString();
  const { error } = await supabase.from("appointments").insert({
    tenant_id: ctx.tenantId,
    lead_id: parsed.lead_id,
    assigned_to: parsed.assigned_to ?? null,
    professional_id: parsed.professional_id ?? null,
    service_id: parsed.service_id ?? null,
    starts_at: startsAtIso,
    duration_minutes: parsed.duration_minutes,
    notes: parsed.notes?.trim() || null,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  await notifyAppointmentAssignee(supabase, {
    tenantId: ctx.tenantId,
    assigneeId: parsed.assigned_to,
    leadId: parsed.lead_id,
    leadName: parsed.lead_name ?? null,
    startsAtIso,
  });

  revalidatePath("/agenda");
  revalidatePath("/reunioes");
  revalidatePath("/dashboard");
}
