import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp, RefreshCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/utils";
import { MovementForm } from "./movement-form";
import { TransferForm } from "./transfer-form";
import { ReservationForm } from "./reservation-form";
import { RecipeForm } from "./recipe-form";
import { ProduceForm } from "./produce-form";
import { EditProductDialog } from "./edit-product-dialog";
import { availableStock } from "@/lib/estoque/reservations";
import {
  consumeReservation,
  releaseReservation,
  listStockLocations,
  getProductRecipe,
  listProductsForRecipe,
} from "../actions";
import { formatBRTFullDateTime } from "@/lib/date/brt";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!ctx.tenant.stock_enabled) notFound();

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!product) notFound();

  const [
    { data: movements },
    { data: reservations },
    { data: leads },
    { data: appointments },
    locations,
    { data: stockByLocation },
    recipeItems,
    materialOptions,
  ] = await Promise.all([
    supabase.from("stock_movements").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("stock_reservations").select("id, product_id, quantity, status, leads(name), appointments(starts_at)").eq("product_id", id).order("created_at", { ascending: false }),
    supabase.from("leads").select("id, name").eq("tenant_id", ctx.tenantId).order("name"),
    supabase.from("appointments").select("id, starts_at").eq("tenant_id", ctx.tenantId).order("starts_at", { ascending: false }).limit(50),
    listStockLocations(),
    supabase.from("product_stock").select("location_id, quantity").eq("product_id", id),
    getProductRecipe(id),
    listProductsForRecipe(id),
  ]);
  const available = availableStock(product.stock_quantity, reservations ?? []);
  const reserved = product.stock_quantity - available;

  const quantityByLocation = new Map((stockByLocation ?? []).map((row) => [row.location_id, row.quantity]));

  return (
    <div className="p-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/estoque"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      </Button>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[
              `SKU: ${product.sku ?? "-"}`,
              formatCurrencyBRL(product.price_cents),
              product.tone,
              product.length_cm ? `${product.length_cm} cm` : null,
              product.texture,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <EditProductDialog product={product} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Estoque atual</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-2xl font-bold">{product.stock_quantity}</p><p className="text-xs text-muted-foreground">fisico</p></div>
              <div><p className="text-2xl font-bold">{reserved}</p><p className="text-xs text-muted-foreground">reservado</p></div>
              <div><p className="text-2xl font-bold">{available}</p><p className="text-xs text-muted-foreground">disponivel</p></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">minimo: {product.min_stock}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <a href="#registrar-movimentacao">Ajustar quantidade</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Estoque por local</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/70">
              {locations.map((loc) => (
                <li key={loc.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{loc.name}</span>
                  <span className="font-semibold">{quantityByLocation.get(loc.id) ?? 0}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Transferir entre locais</CardTitle></CardHeader>
          <CardContent>
            <TransferForm productId={product.id} locations={locations} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Receita de producao</CardTitle></CardHeader>
          <CardContent>
            <RecipeForm
              productId={product.id}
              materials={materialOptions}
              initialItems={recipeItems.map((item) => ({
                materialProductId: item.materialProductId,
                quantity: item.quantity,
              }))}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Fabricar</CardTitle></CardHeader>
          <CardContent>
            <ProduceForm productId={product.id} locations={locations} hasRecipe={recipeItems.length > 0} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Reservas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ReservationForm productId={product.id} leads={leads ?? []} appointments={appointments ?? []} />
            <div className="divide-y divide-border/70">
              {(reservations ?? []).length === 0 && <p className="py-3 text-sm text-muted-foreground">Sem reservas ainda.</p>}
              {(reservations ?? []).map((reservation) => {
                const lead = reservation.leads as unknown as { name: string } | null;
                return (
                  <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div><p className="font-medium">{reservation.quantity} unidade(s) · {lead?.name ?? "Sem cliente vinculada"}</p><p className="text-xs text-muted-foreground">{reservation.status}</p></div>
                    {reservation.status === "active" && <div className="flex gap-2">
                      <form action={releaseReservation}><input type="hidden" name="id" value={reservation.id} /><input type="hidden" name="product_id" value={product.id} /><Button variant="outline" size="sm">Liberar</Button></form>
                      <form action={consumeReservation}><input type="hidden" name="id" value={reservation.id} /><Button size="sm">Consumir</Button></form>
                    </div>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card id="registrar-movimentacao" className="lg:col-span-2 scroll-mt-4">
          <CardHeader><CardTitle>Registrar movimentacao</CardTitle></CardHeader>
          <CardContent>
            <MovementForm productId={product.id} locations={locations} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Historico</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {(movements ?? []).length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">Sem movimentacoes ainda.</p>
              )}
              {movements?.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2">
                    {m.kind === "in" && <ArrowDown className="h-4 w-4 text-green-600" />}
                    {m.kind === "out" && <ArrowUp className="h-4 w-4 text-red-600" />}
                    {m.kind === "adjust" && <RefreshCcw className="h-4 w-4 text-blue-600" />}
                    <span className="font-medium">
                      {m.kind === "in" ? "Entrada" : m.kind === "out" ? "Saida" : "Ajuste"}
                    </span>
                    <span className="text-muted-foreground">{m.reason ?? ""}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold">{m.quantity}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBRTFullDateTime(m.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
