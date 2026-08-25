"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

async function requireProspectionContext() {
  const ctx = await requireContext();
  if (!ctx.tenant.lead_folders_enabled) throw new Error("Modulo de prospeccao desativado para esta empresa");
  if (!["prospeccao", "owner", "admin"].includes(ctx.role)) throw new Error("Sem permissao");
  return ctx;
}

export type SellerOption = { id: string; name: string };

export async function listSellers(): Promise<SellerOption[]> {
  const ctx = await requireProspectionContext();
  const supabase = createServiceClient();

  const { data: members } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "vendedor");

  const ids = [...new Set(((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id))];
  if (ids.length === 0) return [];

  // Service client de proposito: a RLS de `profiles` so deixa cada um ler o
  // proprio perfil, entao com o client normal TODA vendedora vinha sem nome
  // e o select virava uma lista de "Vendedora" repetida, impossivel de usar.
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const nameById = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name]),
  );
  return ids
    .map((id) => ({
      id,
      name: nameById.get(id)?.trim() || "Sem nome",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const leadFolderSchema = z.enum(["primeiro_contato", "reaplicacao", "mkt"]);

const createAndRouteSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  source: z.string().optional(),
  referredByPartnerId: z.string().uuid().optional(),
  // Peca por peca que o parceiro (loja/vendedor) passou pra Jeruza de
  // viva voz - texto livre porque cada parceiro descreve do seu jeito.
  // Fica gravado no lead (custom_fields) e visivel ate finalizar, pra
  // sempre dar pra saber por onde e de onde o lead veio.
  pieces: z.string().optional(),
  // Sem vendedora = fluxo normal: cai na pasta sem dono, e a gerente
  // (Michele) distribui de la. So preenche em emergencia, mandando direto.
  sellerId: z.string().uuid().optional(),
  folder: leadFolderSchema,
});

export type CreateAndRouteResult = { ok: true; leadId: string } | { ok: false; error: string };

/** Cadastra o lead e joga na pasta. O caminho normal e sem dono - a pasta e
 * a fila que a gerente distribui. Vendedora especifica so em emergencia. */
export async function createAndRouteLead(formData: FormData): Promise<CreateAndRouteResult> {
  const ctx = await requireProspectionContext();
  const supabase = await createClient();

  const parsed = createAndRouteSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    source: formData.get("source") || undefined,
    referredByPartnerId: formData.get("referredByPartnerId") || undefined,
    pieces: formData.get("pieces") || undefined,
    sellerId: formData.get("sellerId") || undefined,
    folder: formData.get("folder"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados." };
  }
  const input = parsed.data;

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_default", true)
    .single();
  const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
    ?.pipeline_stages?.sort((a, b) => a.position - b.position);
  const stageId = stages?.[0]?.id;
  if (!stageId) return { ok: false, error: "Nenhuma etapa do funil está configurada." };

  const { data: created, error } = await supabase
    .from("leads")
    .insert({
      tenant_id: ctx.tenantId,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      source: input.source || "prospeccao",
      referred_by_partner_id: input.referredByPartnerId ?? null,
      stage_id: stageId,
      pipeline_id: (pipeline as { id?: string } | null)?.id,
      assigned_to: input.sellerId ?? null,
      lead_folder: input.folder,
      custom_fields: input.pieces?.trim() ? { partner_pieces: input.pieces.trim() } : undefined,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/prospeccao");
  return { ok: true, leadId: created.id };
}

export type PartnerRow = { id: string; kind: "loja" | "vendedor"; name: string; phone: string | null };

export async function searchPartners(query: string): Promise<PartnerRow[]> {
  const ctx = await requireProspectionContext();
  const supabase = await createClient();

  let q = supabase
    .from("field_service_partners")
    .select("id, kind, name, phone")
    .eq("tenant_id", ctx.tenantId)
    .eq("is_active", true)
    .order("name")
    .limit(30);
  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerRow[];
}

const createPartnerSchema = z.object({
  kind: z.enum(["loja", "vendedor"]),
  name: z.string().min(1, "Nome obrigatorio"),
  phone: z.string().optional(),
  storeId: z.string().uuid().optional(),
});

export type CreatePartnerResult = { ok: true; partner: PartnerRow } | { ok: false; error: string };

/** Vendedor de loja parceira: fica vinculado a loja (store_id), nao e um
 * "vendedor externo" solto - a Jeruza cadastra a loja e quem vende por ela. */
export async function createPartner(formData: FormData): Promise<CreatePartnerResult> {
  const ctx = await requireProspectionContext();
  const supabase = await createClient();

  const parsed = createPartnerSchema.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    storeId: formData.get("storeId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados." };

  const { data, error } = await supabase
    .from("field_service_partners")
    .insert({
      tenant_id: ctx.tenantId,
      kind: parsed.data.kind,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      store_id: parsed.data.kind === "vendedor" ? (parsed.data.storeId ?? null) : null,
    })
    .select("id, kind, name, phone")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/prospeccao");
  return { ok: true, partner: data as PartnerRow };
}
