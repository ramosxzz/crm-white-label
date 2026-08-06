"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function getSaleStockContext() {
  const ctx = await requireContext();
  if (!ctx.tenant.stock_enabled || !ctx.tenant.stock_deduct_on_won) return null;

  const supabase = await createClient();
  const [{ data: products }, { data: locations }] = await Promise.all([
    supabase.from("products").select("id, name").eq("tenant_id", ctx.tenantId).order("name"),
    supabase.from("stock_locations").select("id, name, is_default").eq("tenant_id", ctx.tenantId).order("is_default", { ascending: false }),
  ]);

  return {
    products: (products ?? []).map((p) => ({ id: p.id, name: p.name })),
    locations: (locations ?? []).map((l) => ({ id: l.id, name: l.name, isDefault: l.is_default })),
  };
}

export async function recordSaleStockMovement(input: {
  leadId: string;
  productId: string;
  locationId: string;
  quantity: number;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.stock_enabled) throw new Error("Modulo de estoque desativado para esta empresa");
  if (input.quantity <= 0) throw new Error("Quantidade deve ser maior que zero");

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    tenant_id: ctx.tenantId,
    product_id: input.productId,
    location_id: input.locationId,
    lead_id: input.leadId,
    user_id: ctx.userId,
    kind: "out",
    quantity: input.quantity,
    reason: "Venda - lead fechado",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/estoque");
  revalidatePath(`/estoque/${input.productId}`);
}
