import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders, canReviewServiceOrder } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { formatServiceOrderCode } from "@/lib/field-service/status";
import type { FieldServicePartner } from "@/lib/supabase/database.types";
import { PartnerDetail } from "./partner-detail";
import type { ReferredOrder } from "./partner-detail";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  if (!canManageServiceOrders(ctx.role)) redirect("/os");

  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("field_service_partners")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!partner) notFound();

  const [{ data: stores }, { data: orders }, { data: commissions }] = await Promise.all([
    partner.kind === "vendedor"
      ? supabase
          .from("field_service_partners")
          .select("id, name")
          .eq("tenant_id", ctx.tenantId)
          .eq("kind", "loja")
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] }),
    // Toda OS onde este parceiro entrou, como loja ou como vendedor.
    supabase
      .from("service_orders")
      .select("id, code_seq, status, total_cents, created_at, leads(name)")
      .eq("tenant_id", ctx.tenantId)
      .or(`partner_store_id.eq.${id},partner_seller_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(200),
    // A RLS de commissions so libera owner/admin (mesmo corte do
    // /financeiro). Pedir aqui pra quem nao pode ver so voltaria vazio, e a
    // tela mostraria "comissao gerada: R$0,00" de forma enganosa - melhor
    // nem pedir e a tela ja saber que o dado nao esta disponivel.
    canReviewServiceOrder(ctx.role)
      ? supabase
          .from("commissions")
          .select("service_order_id, amount_cents, status")
          .eq("tenant_id", ctx.tenantId)
          .eq("partner_id", id)
      : Promise.resolve({ data: [] }),
  ]);

  const commissionByOrder = new Map<string, { amount_cents: number; status: string }>();
  for (const c of (commissions ?? []) as Array<{
    service_order_id: string;
    amount_cents: number;
    status: string;
  }>) {
    commissionByOrder.set(c.service_order_id, { amount_cents: c.amount_cents, status: c.status });
  }

  const referred: ReferredOrder[] = ((orders ?? []) as any[]).map((o) => ({
    id: o.id,
    code: formatServiceOrderCode(o.code_seq),
    leadName: o.leads?.name ?? "Lead removido",
    status: o.status,
    totalCents: o.total_cents ?? 0,
    createdAt: o.created_at,
    commissionCents: commissionByOrder.get(o.id)?.amount_cents ?? null,
    commissionStatus: commissionByOrder.get(o.id)?.status ?? null,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Serviço em campo"
        title={partner.name}
        description={partner.kind === "loja" ? "Loja parceira" : "Vendedor parceiro"}
        actions={
          <Link
            href="/os/parceiros"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            <ArrowLeft className="h-4 w-4" /> Parceiros
          </Link>
        }
      />
      <div className="p-8">
        <PartnerDetail
          partner={partner as FieldServicePartner}
          stores={(stores ?? []) as { id: string; name: string }[]}
          referred={referred}
          canSeeCommissions={canReviewServiceOrder(ctx.role)}
        />
      </div>
    </div>
  );
}
