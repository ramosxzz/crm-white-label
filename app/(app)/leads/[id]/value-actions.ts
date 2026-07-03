"use server";

import { revalidatePath } from "next/cache";
import { canOperateLead, assertRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

export async function addLeadValueItem(input: { leadId: string; label: string; amountCents: number }) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const label = input.label.trim();
  if (!label) throw new Error("Descricao obrigatoria");
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Valor invalido");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("lead_value_items").insert({
    tenant_id: ctx.tenantId,
    lead_id: input.leadId,
    label,
    amount_cents: Math.round(input.amountCents),
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${input.leadId}`);
}

export async function deleteLeadValueItem(input: { id: string; leadId: string }) {
  const ctx = await requireContext();
  assertRole(ctx.role, canOperateLead);
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_value_items")
    .delete()
    .eq("id", input.id)
    .eq("lead_id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/leads/${input.leadId}`);
}
