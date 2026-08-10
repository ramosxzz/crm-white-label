import { createServiceClient } from "@/lib/supabase/server";
import { fetchApi4comCalls } from "@/lib/integrations/api4com";

type CallAttemptRow = {
  lead_id: string | null;
  api4com_call_id: string | null;
};

export async function fetchLeadCallCountsForTenant(
  tenantId: string,
  options: { includeApi4com?: boolean; leadIds?: string[] } = {},
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const seenApi4comIds = new Set<string>();
  const supabase = createServiceClient();

  // Sem leadIds, busca o tenant inteiro (chat/dashboard precisam disso). Com
  // leadIds (ex: kanban de um funil so), escopa a query - evita buscar ate
  // 10 mil linhas de call_attempts de OUTROS funis so pra descartar depois.
  let query = supabase
    .from("call_attempts")
    .select("lead_id, api4com_call_id")
    .eq("tenant_id", tenantId)
    .not("lead_id", "is", null)
    .limit(10000);
  if (options.leadIds) query = query.in("lead_id", options.leadIds);

  const { data, error } = await query;

  if (error) {
    console.warn("[call-counts] Failed to load local call attempts", error.message);
  }

  for (const row of (data ?? []) as CallAttemptRow[]) {
    if (!row.lead_id) continue;
    if (row.api4com_call_id) seenApi4comIds.add(row.api4com_call_id);
    counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
  }

  if (options.includeApi4com) {
    const leadIdFilter = options.leadIds ? new Set(options.leadIds) : null;
    try {
      const calls = await fetchApi4comCalls();
      for (const call of calls) {
        const leadId = typeof call.metadata?.lead_id === "string" ? call.metadata.lead_id : null;
        const callTenantId = typeof call.metadata?.tenant_id === "string" ? call.metadata.tenant_id : null;
        if (!leadId || callTenantId !== tenantId) continue;
        if (leadIdFilter && !leadIdFilter.has(leadId)) continue;
        if (call.id && seenApi4comIds.has(call.id)) continue;
        if (call.id) seenApi4comIds.add(call.id);
        counts[leadId] = (counts[leadId] ?? 0) + 1;
      }
    } catch (error) {
      console.warn("[call-counts] Failed to load Api4com call attempts", error);
    }
  }

  return counts;
}
