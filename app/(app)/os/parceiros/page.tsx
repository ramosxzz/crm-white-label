import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import type { FieldServicePartner } from "@/lib/supabase/database.types";
import { PartnersPanel } from "./partners-panel";
import { ServiceOrdersLive } from "../service-orders-live";

export default async function PartnersPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  if (!canManageServiceOrders(ctx.role)) redirect("/os");

  const supabase = await createClient();
  const { data: partners } = await supabase
    .from("field_service_partners")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("kind")
    .order("name");

  return (
    <div>
      <ServiceOrdersLive tenantId={ctx.tenantId} />
      <PageHeader
        eyebrow="Serviço em campo"
        title="Lojas e vendedores parceiros"
        description="Cadastro de quem indica clientes, pra dividir a comissão entre a loja e o vendedor responsável."
      />
      <div className="p-8">
        <PartnersPanel partners={(partners ?? []) as FieldServicePartner[]} />
      </div>
    </div>
  );
}
