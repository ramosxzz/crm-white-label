"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canReviewServiceOrder } from "@/lib/auth/roles";
import type {
  CommissionParty,
  ServiceCatalogCategory,
} from "@/lib/supabase/database.types";

type Ctx = Awaited<ReturnType<typeof requireContext>>;

/**
 * Financeiro e so da gestao (resposta 18 do briefing: vendedora e tecnico
 * nao veem o caixa da empresa). A RLS ja bloqueia, isso aqui e a mensagem
 * de erro decente antes de bater no banco.
 */
async function requireFinanceContext(): Promise<Ctx> {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) {
    throw new Error("Modulo de servico em campo desativado para esta empresa");
  }
  if (!canReviewServiceOrder(ctx.role)) {
    throw new Error("Sem permissao para acessar o financeiro");
  }
  return ctx;
}

const entrySchema = z.object({
  kind: z.enum(["pagar", "receber"]),
  description: z.string().trim().min(1),
  amount: z.number().positive("Informe um valor maior que zero"),
  // Vencimento e obrigatorio: a tela e mensal e filtra por ele, entao um
  // lancamento sem data simplesmente nao apareceria em mes nenhum.
  due_date: z.string().min(1, "Informe o vencimento"),
  category: z.string().trim().optional(),
  is_recurring: z.boolean(),
});

function readForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function createFinanceEntry(formData: FormData) {
  const ctx = await requireFinanceContext();

  const parsed = entrySchema.parse({
    kind: formData.get("kind"),
    description: formData.get("description"),
    amount: Number(formData.get("amount") ?? 0),
    due_date: readForm(formData, "due_date"),
    category: readForm(formData, "category"),
    is_recurring: formData.get("is_recurring") === "on",
  });

  // Conta fixa repete no mesmo dia do vencimento todo mes.
  const dueDate = parsed.due_date;
  const recurrenceDay = parsed.is_recurring ? Number(dueDate.split("-")[2]) : null;

  const supabase = await createClient();
  const { error } = await supabase.from("finance_entries").insert({
    tenant_id: ctx.tenantId,
    kind: parsed.kind,
    description: parsed.description,
    amount_cents: Math.round(parsed.amount * 100),
    due_date: dueDate,
    category: parsed.category ?? null,
    is_recurring: recurrenceDay != null,
    recurrence_day: recurrenceDay,
    status: "aberta",
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
}

export async function setFinanceEntryPaid(input: { id: string; paid: boolean }) {
  const ctx = await requireFinanceContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("finance_entries")
    .update({
      status: input.paid ? "paga" : "aberta",
      paid_at: input.paid ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
}

export async function deleteFinanceEntry(input: { id: string }) {
  const ctx = await requireFinanceContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("finance_entries")
    .delete()
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
}

export async function setCommissionStatus(input: {
  id: string;
  status: "prevista" | "aprovada" | "paga";
}) {
  const ctx = await requireFinanceContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("commissions")
    .update({
      status: input.status,
      paid_at: input.status === "paga" ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
}

export async function requestCommissionAdjustment(input: {
  id: string;
  amount: number;
  reason: string;
}) {
  const ctx = await requireFinanceContext();
  const parsed = z
    .object({
      id: z.string().uuid(),
      amount: z.number().min(0),
      reason: z.string().trim().min(3).max(1000),
    })
    .parse(input);
  const supabase = await createClient();

  const { data: commission, error: readError } = await supabase
    .from("commissions")
    .select("id, service_order_id, amount_cents")
    .eq("id", parsed.id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (readError) throw new Error(readError.message);

  const { error } = await supabase.from("financial_adjustment_requests").insert({
    tenant_id: ctx.tenantId,
    service_order_id: commission.service_order_id,
    commission_id: commission.id,
    adjustment_kind: "comissao",
    payload: {
      amount_cents: Math.round(parsed.amount * 100),
      previous_amount_cents: commission.amount_cents,
    },
    reason: parsed.reason,
    requested_by: ctx.userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
  revalidatePath(`/os/${commission.service_order_id}`);
}

const paymentRatesSchema = z.array(
  z.object({
    id: z.string().uuid(),
    fee_percent: z.number().min(0).max(100),
    installment_count: z.number().int().min(1).max(36),
    minimum_installment: z.number().min(0),
    is_active: z.boolean(),
  }),
);

export async function updatePaymentMethodRates(input: Array<{
  id: string;
  fee_percent: number;
  installment_count: number;
  minimum_installment: number;
  is_active: boolean;
}>) {
  const ctx = await requireFinanceContext();
  const rows = paymentRatesSchema.parse(input);
  const supabase = await createClient();

  for (const row of rows) {
    const { error } = await supabase
      .from("payment_method_rates")
      .update({
        fee_percent: row.fee_percent,
        installment_count: row.installment_count,
        minimum_installment_cents: Math.round(row.minimum_installment * 100),
        is_active: row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/financeiro");
}

export async function createPaymentMethodRate(input: {
  name: string;
  fee_percent: number;
  installment_count: number;
  minimum_installment: number;
}) {
  const ctx = await requireFinanceContext();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(100),
      fee_percent: z.number().min(0).max(100),
      installment_count: z.number().int().min(1).max(36),
      minimum_installment: z.number().min(0),
    })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("payment_method_rates").upsert(
    {
      tenant_id: ctx.tenantId,
      name: parsed.name,
      fee_percent: parsed.fee_percent,
      installment_count: parsed.installment_count,
      minimum_installment_cents: Math.round(parsed.minimum_installment * 100),
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,name" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
}

const catalogCategorySchema = z.enum([
  "lavagem",
  "impermeabilizacao",
  "couro",
  "outro",
]);

export async function createServiceCatalogItem(input: {
  category: ServiceCatalogCategory;
  name: string;
  unit: string;
  price: number;
}) {
  const ctx = await requireFinanceContext();
  const parsed = z
    .object({
      category: catalogCategorySchema,
      name: z.string().trim().min(2).max(150),
      unit: z.string().trim().min(1).max(30),
      price: z.number().min(0),
    })
    .parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from("service_catalog_items").upsert(
    {
      tenant_id: ctx.tenantId,
      category: parsed.category,
      name: parsed.name,
      unit: parsed.unit,
      price_cents: Math.round(parsed.price * 100),
      is_active: true,
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,category,name" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/os");
}

const catalogRowsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    price: z.number().min(0),
    is_active: z.boolean(),
  }),
);

export async function updateServiceCatalogItems(
  input: Array<{ id: string; price: number; is_active: boolean }>,
) {
  const ctx = await requireFinanceContext();
  const rows = catalogRowsSchema.parse(input);
  const supabase = await createClient();

  for (const row of rows) {
    const { error } = await supabase
      .from("service_catalog_items")
      .update({
        price_cents: Math.round(row.price * 100),
        is_active: row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/financeiro");
  revalidatePath("/os");
}

const rulesSchema = z.object({
  tecnico: z.number().min(0).max(100),
  vendedora_interna: z.number().min(0).max(100),
  loja_parceira: z.number().min(0).max(100),
});

/** Percentuais ficam em tabela justamente pra mudar sem deploy. */
export async function updateCommissionRules(formData: FormData) {
  const ctx = await requireFinanceContext();

  const parsed = rulesSchema.parse({
    tecnico: Number(formData.get("tecnico") ?? 0),
    vendedora_interna: Number(formData.get("vendedora_interna") ?? 0),
    loja_parceira: Number(formData.get("loja_parceira") ?? 0),
  });

  const supabase = await createClient();
  const rows: Array<{ party_kind: CommissionParty; percent: number }> = [
    { party_kind: "tecnico", percent: parsed.tecnico },
    { party_kind: "vendedora_interna", percent: parsed.vendedora_interna },
    { party_kind: "loja_parceira", percent: parsed.loja_parceira },
  ];

  for (const row of rows) {
    const { error } = await supabase.rpc("set_commission_rule", {
      p_tenant_id: ctx.tenantId,
      p_party_kind: row.party_kind,
      p_user_id: null,
      p_percent: row.percent,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/financeiro");
}

/** Override pessoal de comissao pra uma vendedora especifica - sobrescreve o
 * percentual padrao so pra ela. percent null remove o override (volta a usar
 * o padrao do tenant). */
export async function setSellerCommissionOverride(input: { userId: string; percent: number | null }) {
  const ctx = await requireFinanceContext();
  const supabase = await createClient();

  if (input.percent === null) {
    const { error } = await supabase
      .from("commission_rules")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("party_kind", "vendedora_interna")
      .eq("user_id", input.userId);
    if (error) throw new Error(error.message);
  } else {
    if (input.percent < 0 || input.percent > 100) throw new Error("Percentual invalido");
    const { error } = await supabase.rpc("set_commission_rule", {
      p_tenant_id: ctx.tenantId,
      p_party_kind: "vendedora_interna",
      p_user_id: input.userId,
      p_percent: input.percent,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/financeiro");
}
