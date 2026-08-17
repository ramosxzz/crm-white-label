import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";

export type HealthStatus = "healthy" | "warning" | "offline";

export interface AccountHealthInfo {
  accountId: string;
  displayName: string | null;
  phoneNumber: string;
  provider: string;
  status: HealthStatus;
  lastErrorMessage: string | null;
  lastHeartbeatAt: string | null;
}

/**
 * Atualiza o status de saúde da conta no banco de dados.
 */
export async function recordAccountHealthHeartbeat(
  supabase: SupabaseClient,
  accountId: string,
  status: HealthStatus = "healthy",
  errorMessage: string | null = null
): Promise<void> {
  const isHealthy = status === "healthy";

  try {
    const updateData: Record<string, unknown> = {
      health_status: status,
      last_health_check_at: new Date().toISOString(),
      last_error_message: errorMessage,
    };

    if (isHealthy) {
      updateData.last_heartbeat_at = new Date().toISOString();
      updateData.consecutive_health_failures = 0;
    }

    await supabase
      .from("whatsapp_accounts")
      .update(updateData)
      .eq("id", accountId);
  } catch (err) {
    console.error("[whatsapp-health] Erro ao registrar saúde:", err);
  }
}

/**
 * Retorna se o tenant possui contas de WhatsApp com problemas de conexão.
 */
export async function getTenantWhatsAppAlerts(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccountHealthInfo[]> {
  try {
    const { data: accounts, error } = await supabase
      .from("whatsapp_accounts")
      .select("id, display_name, phone_number, provider, health_status, last_error_message, last_heartbeat_at")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (error || !accounts) return [];

    return accounts
      .filter((acc: any) => acc.health_status === "offline" || acc.health_status === "warning")
      .map((acc: any) => ({
        accountId: acc.id,
        displayName: acc.display_name,
        phoneNumber: acc.phone_number,
        provider: acc.provider,
        status: (acc.health_status as HealthStatus) || "healthy",
        lastErrorMessage: acc.last_error_message,
        lastHeartbeatAt: acc.last_heartbeat_at,
      }));
  } catch {
    return [];
  }
}
