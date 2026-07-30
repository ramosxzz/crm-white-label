"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageServiceOrders } from "@/lib/auth/roles";

type Ctx = Awaited<ReturnType<typeof requireContext>>;

async function requirePartnerContext(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) {
    throw new Error("Modulo de servico em campo desativado para esta empresa");
  }
  if (!canManageServiceOrders(ctx.role)) {
    throw new Error("Sem permissao para gerenciar parceiros");
  }
  return ctx;
}

const partnerSchema = z.object({
  kind: z.enum(["loja", "vendedor"]),
  name: z.string().trim().min(1, "Informe o nome"),
  store_id: z.string().uuid().optional(),
  phone: z.string().trim().optional(),
});

export async function createPartner(formData: FormData) {
  const ctx = await requirePartnerContext();
  const supabase = await createClient();

  const kind = formData.get("kind");
  const parsed = partnerSchema.parse({
    kind,
    name: formData.get("name"),
    // store_id so faz sentido em vendedor; a trigger no banco tambem
    // recusa, isso aqui e so pra nao mandar lixo.
    store_id: kind === "vendedor" ? (formData.get("store_id") || undefined) : undefined,
    phone: formData.get("phone") || undefined,
  });

  const { error } = await supabase.from("field_service_partners").insert({
    tenant_id: ctx.tenantId,
    kind: parsed.kind,
    name: parsed.name,
    store_id: parsed.store_id ?? null,
    phone: parsed.phone?.trim() || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/os/parceiros");
}

export async function setPartnerActive(input: { id: string; is_active: boolean }) {
  const ctx = await requirePartnerContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("field_service_partners")
    .update({ is_active: input.is_active, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/os/parceiros");
}

export async function deletePartner(input: { id: string }) {
  const ctx = await requirePartnerContext();
  const supabase = await createClient();

  // Nao apaga se ja foi usado em alguma OS: apagar quebraria o historico
  // (a FK em service_orders.partner_store_id/partner_seller_id e
  // "on delete set null", entao nao falharia sozinho - a checagem e pra
  // avisar em vez de silenciosamente desligar a OS antiga do parceiro).
  const { count } = await supabase
    .from("service_orders")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .or(`partner_store_id.eq.${input.id},partner_seller_id.eq.${input.id}`);
  if (count && count > 0) {
    throw new Error(
      `Esse parceiro está em ${count} ordem${count === 1 ? "" : "s"} de serviço. Desative em vez de remover.`,
    );
  }

  const { error } = await supabase
    .from("field_service_partners")
    .delete()
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/os/parceiros");
}
