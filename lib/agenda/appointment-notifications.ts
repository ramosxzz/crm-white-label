import type { SupabaseClient } from "@supabase/supabase-js";

type NotifyAppointmentAssigneeInput = {
  tenantId: string;
  assigneeId?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  startsAtIso: string;
};

function dayParam(startsAtIso: string) {
  return new Date(startsAtIso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function formatMeetingTime(startsAtIso: string) {
  return new Date(startsAtIso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export async function notifyAppointmentAssignee(
  supabase: SupabaseClient,
  input: NotifyAppointmentAssigneeInput,
) {
  if (!input.assigneeId) return;

  const leadLabel = input.leadName?.trim() || "Reuniao";
  const startsAtLabel = formatMeetingTime(input.startsAtIso);
  const link = input.leadId ? `/leads/${input.leadId}` : `/agenda?day=${dayParam(input.startsAtIso)}`;

  await supabase.from("notifications").insert({
    tenant_id: input.tenantId,
    user_id: input.assigneeId,
    kind: "appointment_assigned",
    title: "Reuniao atribuida a voce",
    description: `${leadLabel} - ${startsAtLabel}`,
    link,
  });
}
