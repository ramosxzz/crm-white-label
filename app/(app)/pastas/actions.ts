"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canSeeAllLeads } from "@/lib/auth/roles";

export type SellerOption = { id: string; name: string };

/** Vendedoras pra quem a gerente pode distribuir os leads da pasta. */
export async function listSellersForFolders(): Promise<SellerOption[]> {
  const ctx = await requireContext();
  if (!canSeeAllLeads(ctx.role)) return [];
  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "vendedor");

  const ids = [...new Set(((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id))];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const nameById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]),
  );
  return ids
    .map((id) => ({ id, name: nameById.get(id)?.trim() || "Sem nome" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Distribui um lead da pasta pra uma vendedora - so a gestao (Michele) faz
 * isso. Passar null devolve o lead pra fila da pasta. */
export async function assignFolderLead(input: { leadId: string; sellerId: string | null }) {
  const ctx = await requireContext();
  if (!canSeeAllLeads(ctx.role)) throw new Error("Sem permissao para distribuir leads");
  const supabase = await createClient();

  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: input.sellerId })
    .eq("id", input.leadId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/pastas");
}
