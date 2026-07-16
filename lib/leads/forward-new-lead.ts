import type { SupabaseClient } from "@supabase/supabase-js";
import { logLeadActivity } from "@/lib/leads/activity-log";
import { notifyUser } from "@/lib/notifications/notify";

/** Se o tenant estiver em "modo ausente" (lead_forward_user_id definido),
 * atribui o lead recem-criado ao vendedor escolhido, registra a movimentacao
 * e notifica o vendedor. Retorna o user_id atribuido, ou null se desligado. */
export async function forwardNewLead(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string,
): Promise<string | null> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("lead_forward_user_id")
    .eq("id", tenantId)
    .maybeSingle();
  const forwardTo = (tenant as { lead_forward_user_id?: string | null } | null)?.lead_forward_user_id ?? null;
  if (!forwardTo) return null;

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: forwardTo })
    .eq("id", leadId)
    .eq("tenant_id", tenantId);
  if (error) return null;

  // Historico de atribuicao + nome do vendedor para a notificacao/atividade.
  let toName: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", forwardTo)
    .maybeSingle();
  toName = (profile as { full_name?: string | null } | null)?.full_name ?? null;

  await supabase.from("lead_assignment_history").insert({
    tenant_id: tenantId,
    lead_id: leadId,
    from_user_id: null,
    to_user_id: forwardTo,
    assigned_by: null,
    reason: "manual_assign",
  });

  const { data: leadRow } = await supabase.from("leads").select("name").eq("id", leadId).maybeSingle();

  void logLeadActivity(supabase, {
    tenantId,
    leadId,
    kind: "assigned",
    payload: { to_user_name: toName, unassigned: false, forwarded: true },
  });
  void notifyUser(supabase, {
    tenantId,
    userId: forwardTo,
    kind: "lead_assigned",
    title: "Novo lead encaminhado para voce",
    description: (leadRow as { name?: string } | null)?.name ?? "Um lead novo caiu para voce",
    link: `/leads/${leadId}`,
  });

  return forwardTo;
}
