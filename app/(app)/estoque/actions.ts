"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import type { StockMovementKind } from "@/lib/supabase/database.types";
import { assertReservationFits, availableStock } from "@/lib/estoque/reservations";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.number().min(0),
  cost: z.number().min(0),
  stock_quantity: z.number().int().min(0),
  min_stock: z.number().int().min(0),
  tone: z.string().optional(),
  length_cm: z.number().int().positive().optional(),
  texture: z.string().optional(),
});

function assertStockModuleEnabled(ctx: Awaited<ReturnType<typeof requireContext>>) {
  if (!ctx.tenant.stock_enabled) throw new Error("Modulo de estoque desativado para esta empresa");
}

export async function createProduct(formData: FormData) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();

  const parsed = productSchema.parse({
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    description: formData.get("description") || undefined,
    price: Number(formData.get("price") ?? 0),
    cost: Number(formData.get("cost") ?? 0),
    stock_quantity: Number(formData.get("stock_quantity") ?? 0),
    min_stock: Number(formData.get("min_stock") ?? 0),
    tone: formData.get("tone") || undefined,
    length_cm: formData.get("length_cm") ? Number(formData.get("length_cm")) : undefined,
    texture: formData.get("texture") || undefined,
  });

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      tenant_id: ctx.tenantId,
      name: parsed.name,
      sku: parsed.sku ?? null,
      description: parsed.description ?? null,
      price_cents: Math.round(parsed.price * 100),
      cost_cents: Math.round(parsed.cost * 100),
      stock_quantity: parsed.stock_quantity,
      min_stock: parsed.min_stock,
      tone: parsed.tone ?? null,
      length_cm: parsed.length_cm ?? null,
      texture: parsed.texture ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // O estoque inicial entra no local padrao do tenant (products.stock_quantity
  // e so o rollup - a fonte de verdade por local e product_stock).
  if (product && parsed.stock_quantity > 0) {
    const { data: defaultLocation } = await supabase
      .from("stock_locations")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_default", true)
      .maybeSingle();
    if (defaultLocation) {
      await supabase.from("product_stock").insert({
        tenant_id: ctx.tenantId,
        product_id: product.id,
        location_id: defaultLocation.id,
        quantity: parsed.stock_quantity,
      });
    }
  }

  revalidatePath("/estoque");
}

export async function deleteProduct(id: string) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
}

export async function recordMovement(input: {
  productId: string;
  locationId: string;
  kind: StockMovementKind;
  quantity: number;
  reason?: string;
}) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    tenant_id: ctx.tenantId,
    product_id: input.productId,
    location_id: input.locationId,
    user_id: ctx.userId,
    kind: input.kind,
    quantity: input.quantity,
    reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
  revalidatePath(`/estoque/${input.productId}`);
}

export async function transferStock(input: {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  reason?: string;
}) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_tenant_id: ctx.tenantId,
    p_product_id: input.productId,
    p_from_location_id: input.fromLocationId,
    p_to_location_id: input.toLocationId,
    p_quantity: input.quantity,
    p_user_id: ctx.userId,
    p_reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
  revalidatePath(`/estoque/${input.productId}`);
}

export async function getProductRecipe(productId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_recipe_items")
    .select("id, material_product_id, quantity, products!product_recipe_items_material_product_id_fkey(name)")
    .eq("tenant_id", ctx.tenantId)
    .eq("product_id", productId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((item) => ({
    id: item.id as string,
    materialProductId: item.material_product_id as string,
    quantity: item.quantity as number,
    materialName: (item.products as unknown as { name: string } | null)?.name ?? "Produto removido",
  }));
}

export async function saveProductRecipe(
  productId: string,
  items: { materialProductId: string; quantity: number }[],
) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();

  const cleaned = items.filter((item) => item.materialProductId && item.quantity > 0);
  if (cleaned.some((item) => item.materialProductId === productId)) {
    throw new Error("Um produto nao pode ser materia-prima de si mesmo");
  }

  const { error: deleteError } = await supabase
    .from("product_recipe_items")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("product_id", productId);
  if (deleteError) throw new Error(deleteError.message);

  if (cleaned.length > 0) {
    const { error: insertError } = await supabase.from("product_recipe_items").insert(
      cleaned.map((item) => ({
        tenant_id: ctx.tenantId,
        product_id: productId,
        material_product_id: item.materialProductId,
        quantity: item.quantity,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }
  revalidatePath(`/estoque/${productId}`);
}

export async function produceProduct(input: { productId: string; locationId: string; quantity: number }) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();
  const { error } = await supabase.rpc("produce_product", {
    p_tenant_id: ctx.tenantId,
    p_product_id: input.productId,
    p_location_id: input.locationId,
    p_quantity: input.quantity,
    p_user_id: ctx.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
  revalidatePath(`/estoque/${input.productId}`);
}

export async function listProductsForRecipe(excludeProductId?: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  let query = supabase.from("products").select("id, name").eq("tenant_id", ctx.tenantId).order("name");
  if (excludeProductId) query = query.neq("id", excludeProductId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listStockLocations() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_locations")
    .select("id, name, is_default, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createStockLocation(name: string) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  if (!name.trim()) throw new Error("Informe o nome do local");
  const supabase = await createClient();
  const { error } = await supabase.from("stock_locations").insert({ tenant_id: ctx.tenantId, name: name.trim() });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
}

export async function deleteStockLocation(id: string) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("stock_locations")
    .select("is_default")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (location?.is_default) throw new Error("Nao e possivel excluir o local padrao");

  const { data: stock } = await supabase
    .from("product_stock")
    .select("quantity")
    .eq("location_id", id)
    .eq("tenant_id", ctx.tenantId)
    .gt("quantity", 0)
    .limit(1);
  if (stock && stock.length > 0) throw new Error("Transfira o estoque deste local antes de excluir");

  const { error } = await supabase.from("stock_locations").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
}

export async function createReservation(formData: FormData) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const parsed = z.object({
    product_id: z.string().uuid(),
    lead_id: z.string().uuid().optional(),
    appointment_id: z.string().uuid().optional(),
    quantity: z.number().int().positive(),
  }).parse({
    product_id: formData.get("product_id"),
    lead_id: formData.get("lead_id") || undefined,
    appointment_id: formData.get("appointment_id") || undefined,
    quantity: Number(formData.get("quantity")),
  });
  const supabase = await createClient();
  const [{ data: product }, { data: reservations }] = await Promise.all([
    supabase.from("products").select("stock_quantity").eq("id", parsed.product_id).eq("tenant_id", ctx.tenantId).single(),
    supabase.from("stock_reservations").select("quantity, status").eq("product_id", parsed.product_id).eq("tenant_id", ctx.tenantId).eq("status", "active"),
  ]);
  if (!product) throw new Error("Produto nao encontrado");
  assertReservationFits(availableStock(product.stock_quantity, reservations ?? []), parsed.quantity);
  const { error } = await supabase.from("stock_reservations").insert({
    tenant_id: ctx.tenantId,
    product_id: parsed.product_id,
    lead_id: parsed.lead_id ?? null,
    appointment_id: parsed.appointment_id ?? null,
    quantity: parsed.quantity,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  refreshStock(parsed.product_id);
}

export async function releaseReservation(formData: FormData) {
  return changeReservationStatus(formData, "released");
}

export async function consumeReservation(formData: FormData) {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const id = z.string().uuid().parse(formData.get("id"));
  const supabase = await createClient();
  const { data: reservation } = await supabase
    .from("stock_reservations")
    .select("id, product_id, quantity, status")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!reservation || reservation.status !== "active") throw new Error("Reserva ativa nao encontrada");
  const { error: movementError } = await supabase.from("stock_movements").insert({
    tenant_id: ctx.tenantId,
    product_id: reservation.product_id,
    user_id: ctx.userId,
    kind: "out",
    quantity: reservation.quantity,
    reason: "Reserva consumida",
  });
  if (movementError) throw new Error(movementError.message);
  const { error } = await supabase.from("stock_reservations").update({ status: "consumed" }).eq("id", id).eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  refreshStock(reservation.product_id);
}

async function changeReservationStatus(formData: FormData, status: "released") {
  const ctx = await requireContext();
  assertStockModuleEnabled(ctx);
  const id = z.string().uuid().parse(formData.get("id"));
  const productId = z.string().uuid().parse(formData.get("product_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("stock_reservations").update({ status }).eq("id", id).eq("product_id", productId).eq("tenant_id", ctx.tenantId).eq("status", "active");
  if (error) throw new Error(error.message);
  refreshStock(productId);
}

function refreshStock(productId: string) {
  revalidatePath("/estoque");
  revalidatePath(`/estoque/${productId}`);
  revalidatePath("/dashboard");
}
