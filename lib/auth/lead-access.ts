import { createClient } from "@/lib/supabase/server";

/**
 * Confirma o acesso com o client autenticado, portanto passando pela RLS.
 * Use antes de qualquer leitura posterior com service_role em rotas/actions
 * que precisam de credenciais ou dados auxiliares privilegiados.
 */
export async function currentUserCanAccessLead(tenantId: string, leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}
