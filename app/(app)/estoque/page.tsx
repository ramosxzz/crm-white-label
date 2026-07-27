import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canAccessStock } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { NewProductDialog } from "./new-product-dialog";
import { StockLocationsManager } from "./stock-locations-manager";
import { listStockLocations } from "./actions";

export default async function EstoquePage() {
  const ctx = await requireContext();
  if (!ctx.tenant.stock_enabled) redirect("/dashboard");
  if (!canAccessStock(ctx.role)) redirect("/dashboard");

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  const { data: reservations } = await supabase
    .from("stock_reservations")
    .select("product_id, quantity")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "active");
  const reservedByProduct = new Map<string, number>();
  for (const reservation of reservations ?? []) {
    reservedByProduct.set(reservation.product_id, (reservedByProduct.get(reservation.product_id) ?? 0) + reservation.quantity);
  }
  const locations = await listStockLocations();

  return (
    <div>
      <PageHeader
        eyebrow="Catalogo"
        title="Estoque"
        description={`${products?.length ?? 0} produtos cadastrados`}
        actions={<NewProductDialog />}
      />

      <div className="space-y-6 p-8">
        <StockLocationsManager locations={locations} />
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Produto</th>
                <th className="px-5 py-3 font-medium">Detalhes</th>
                <th className="px-5 py-3 font-medium">Preco</th>
                <th className="px-5 py-3 font-medium">Disponivel</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {(products ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <p className="font-medium">Nenhum produto cadastrado</p>
                    <p className="mt-1 text-sm text-muted-foreground">Adicione produtos para comecar a controlar seu estoque.</p>
                  </td>
                </tr>
              )}
              {products?.map((p) => {
                const reserved = reservedByProduct.get(p.id) ?? 0;
                const available = p.stock_quantity - reserved;
                const low = available <= p.min_stock;
                return (
                  <tr key={p.id} className="group transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/estoque/${p.id}`} className="transition-colors hover:text-brand">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{[p.tone, p.length_cm ? `${p.length_cm} cm` : null, p.texture].filter(Boolean).join(" · ") || p.sku || "-"}</td>
                    <td className="px-5 py-3 font-medium">{formatCurrencyBRL(p.price_cents)}</td>
                    <td className="px-5 py-3">
                      <span className={low ? "font-semibold text-destructive" : "font-medium"}>
                        {available}
                      </span>
                      {low && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" /> baixo
                        </span>
                      )}
                      {reserved > 0 && <span className="ml-2 text-xs text-muted-foreground">{reserved} reservado(s)</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={p.is_active ? "success" : "outline"}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/estoque/${p.id}`} className="opacity-0 transition-opacity group-hover:opacity-100">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
