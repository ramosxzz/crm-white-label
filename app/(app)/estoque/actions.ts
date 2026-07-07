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

  const { error } = await supabase.from("products").insert({
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
  });
  if (error) throw new Error(error.message);
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
    user_id: ctx.userId,
    kind: input.kind,
    quantity: input.quantity,
    reason: input.reason ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
  revalidatePath(`/estoque/${input.productId}`);
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
