import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEventParams {
  tenantId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Registra um evento de auditoria imutável no banco de dados.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  params: AuditEventParams
): Promise<{ ok: boolean; error?: string }> {
  const {
    tenantId,
    actorId = null,
    actorEmail = null,
    actorName = null,
    action,
    resourceType,
    resourceId = null,
    metadata = {},
    ipAddress = null,
  } = params;

  if (!tenantId || !action || !resourceType) {
    return { ok: false, error: "Parâmetros obrigatórios ausentes para audit log." };
  }

  try {
    const { error } = await supabase.from("tenant_audit_logs").insert({
      tenant_id: tenantId,
      actor_id: actorId,
      actor_email: actorEmail,
      actor_name: actorName,
      action: action.trim(),
      resource_type: resourceType.trim(),
      resource_id: resourceId ? String(resourceId).trim() : null,
      metadata: metadata ?? {},
      ip_address: ipAddress,
    });

    if (error) {
      console.error("[audit] Erro ao gravar audit log:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    console.error("[audit] Exceção ao gravar audit log:", err);
    return { ok: false, error: (err as Error).message };
  }
}
