"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyAppointmentAssignee } from "@/lib/agenda/appointment-notifications";
import { assertRole, canOperateLead } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

const uuid = z.string().uuid();

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
