import type { SupabaseClient } from "@supabase/supabase-js";

/** Registra uma movimentacao do lead na linha do tempo (lead_activities).
 * Nunca lanca — um erro de log nao deve quebrar a acao principal. */
export async function logLeadActivity(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    leadId: string;
    userId?: string | null;
    kind: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("lead_activities").insert({
      tenant_id: input.tenantId,
      lead_id: input.leadId,
      user_id: input.userId ?? null,
      kind: input.kind,
      payload: input.payload ?? {},
    });
  } catch (err) {
    console.error("[lead-activity] erro ao registrar atividade:", err);
  }
}
