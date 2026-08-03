import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  shouldUpgradeMessageStatus,
  type DbMessageStatus,
  type ZapiMessageStatusUpdate,
} from "./zapi-status";

type ServiceClient = SupabaseClient<Database>;

export async function applyMessageStatusUpdates(
  supabase: ServiceClient,
  tenantId: string,
  updates: ZapiMessageStatusUpdate[],
): Promise<number> {
  let applied = 0;

  for (const update of updates) {
    for (const externalId of update.externalIds) {
      // external_id e unico por conversa, nao mais globalmente - duas contas
      // do mesmo tenant conversando entre si podem gerar duas mensagens
      // (uma por conversa) com o mesmo external_id. Atualiza todas as que
      // baterem em vez de assumir uma unica linha.
      const { data: rows } = await supabase
        .from("messages")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("external_id", externalId)
        .eq("direction", "outbound");

      for (const row of rows ?? []) {
        const current = (row.status as DbMessageStatus | null) ?? "pending";
        if (!shouldUpgradeMessageStatus(current, update.status)) continue;

        await supabase.from("messages").update({ status: update.status }).eq("id", row.id);
        applied++;
      }
    }
  }

  return applied;
}
