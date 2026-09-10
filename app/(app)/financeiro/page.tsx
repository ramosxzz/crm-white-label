import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canReviewServiceOrder } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrencyBRL } from "@/lib/utils";
import { listTenantUserOptions } from "@/lib/tenant/users";
import type {
  CommissionParty,
  CommissionStatus,
  FinanceEntry,
  PaymentMethodRate,
  ServiceCatalogItem,
} from "@/lib/supabase/database.types";
import { CommissionsPanel, type CommissionRow } from "./commissions-panel";
import { EntriesPanel } from "./entries-panel";
import { PaymentRatesPanel } from "./payment-rates-panel";
import { ServiceCatalogPanel } from "./service-catalog-panel";
import { PageTabs } from "@/components/ui/page-tabs";

type FinanceTab = "overview" | "receivable" | "payable" | "commissions" | "rates" | "catalog";

function brtToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function monthOf(day: string) {
  return day.slice(0, 7);
}

function offsetMonth(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  return { start: `${month}-01`, end: `${offsetMonth(month, 1)}-01` };
}

function humanMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; tab?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  // Resposta 18 do briefing: financeiro nao e de todo mundo.
  if (!canReviewServiceOrder(ctx.role)) redirect("/dashboard");

  const params = await searchParams;
  const today = brtToday();
  const month = /^\d{4}-\d{2}$/.test(params?.month ?? "") ? params!.month! : monthOf(today);
  const tab = (["overview", "receivable", "payable", "commissions", "rates", "catalog"].includes(params?.tab ?? "")
    ? params?.tab
    : "overview") as FinanceTab;
  const { start, end } = monthRange(month);

  const supabase = await createClient();

  const [
    { data: entries },
    { data: recurring },
    { data: commissions },
    { data: rules },
    { data: paymentRates },
    { data: catalogItems },
    { data: pendingAdjustments },
  ] =
    await Promise.all([
      ["overview", "receivable", "payable"].includes(tab) ? supabase
        .from("finance_entries")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .gte("due_date", start)
        .lt("due_date", end)
        .order("due_date", { ascending: true }) : Promise.resolve({ data: [] }),
      // Contas fixas alimentam a projecao do mes seguinte ("temos contas para
      // o proximo mes e isso ja deixar fixado").
      tab === "overview" ? supabase
        .from("finance_entries")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_recurring", true) : Promise.resolve({ data: [] }),
      tab === "commissions" ? supabase
        .from("commissions")
        .select("*, service_orders(code_seq)")
        .eq("tenant_id", ctx.tenantId)
        .gte("created_at", `${start}T00:00:00-03:00`)
        .lt("created_at", `${end}T00:00:00-03:00`)
        .order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      tab === "commissions"
        ? supabase.from("commission_rules").select("party_kind, percent, user_id").eq("tenant_id", ctx.tenantId)
        : Promise.resolve({ data: [] }),
      tab === "rates" ? supabase
        .from("payment_method_rates")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .order("name") : Promise.resolve({ data: [] }),
      tab === "catalog" ? supabase
        .from("service_catalog_items")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .order("category")
        .order("name") : Promise.resolve({ data: [] }),
      tab === "commissions" ? supabase
        .from("financial_adjustment_requests")
        .select("id, commission_id")
        .eq("tenant_id", ctx.tenantId)
        .eq("adjustment_kind", "comissao")
        .eq("status", "pendente") : Promise.resolve({ data: [] }),
    ]);

  const rows = (entries ?? []) as FinanceEntry[];
  const toReceive = rows.filter((entry) => entry.kind === "receber");
  const toPay = rows.filter((entry) => entry.kind === "pagar");

  const received = toReceive
    .filter((entry) => entry.status === "paga")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);
  const paid = toPay
    .filter((entry) => entry.status === "paga")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);
  const openToReceive = toReceive
    .filter((entry) => entry.status === "aberta")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);
  const openToPay = toPay
    .filter((entry) => entry.status === "aberta")
    .reduce((sum, entry) => sum + entry.amount_cents, 0);

  const recurringPay = (recurring ?? [])
    .filter((entry: any) => entry.kind === "pagar")
    .reduce((sum: number, entry: any) => sum + entry.amount_cents, 0);

  const users = tab === "commissions" ? await listTenantUserOptions(ctx.tenantId) : [];
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  const pendingAdjustmentByCommission = new Map(
    ((pendingAdjustments ?? []) as Array<{ id: string; commission_id: string | null }>)
      .filter((row) => row.commission_id)
      .map((row) => [row.commission_id!, row.id]),
  );

  const commissionRows: CommissionRow[] = ((commissions ?? []) as any[]).map((row) => ({
    id: row.id,
    party_kind: row.party_kind as CommissionParty,
    who: row.user_id ? (nameById.get(row.user_id) ?? "Usuário") : (row.partner_name ?? "Parceiro"),
    base_cents: row.base_cents,
    percent: Number(row.percent),
    amount_cents: row.amount_cents,
    status: row.status as CommissionStatus,
    order_code: row.service_orders?.code_seq ?? null,
    adjustment_request_id: pendingAdjustmentByCommission.get(row.id) ?? null,
  }));

  const ruleMap: Record<CommissionParty, number> = {
    tecnico: 0,
    vendedora_interna: 0,
    loja_parceira: 0,
    vendedor_externo: 0,
  };
  const sellerOverrides = new Map<string, number>();
  for (const rule of (rules ?? []) as Array<{ party_kind: CommissionParty; percent: number; user_id: string | null }>) {
    if (rule.user_id) {
      if (rule.party_kind === "vendedora_interna") sellerOverrides.set(rule.user_id, Number(rule.percent));
    } else {
      ruleMap[rule.party_kind] = Number(rule.percent);
    }
  }

  const { data: sellerMembers } = tab === "commissions"
    ? await supabase
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", ctx.tenantId)
        .eq("role", "vendedor")
    : { data: [] };
  const sellers = ((sellerMembers ?? []) as Array<{ user_id: string }>)
    .map((m) => ({ id: m.user_id, name: nameById.get(m.user_id) ?? "Vendedora", override: sellerOverrides.get(m.user_id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cards = [
    { label: "Recebido no mês", value: received, tone: "text-success" },
    { label: "Pago no mês", value: paid, tone: "text-destructive" },
    { label: "Saldo", value: received - paid, tone: received - paid >= 0 ? "text-success" : "text-destructive" },
    { label: "Em aberto (receber − pagar)", value: openToReceive - openToPay, tone: "text-foreground" },
  ];
  const tabHref = (target: FinanceTab) => `/financeiro?month=${month}&tab=${target}`;
  const monthHref = (targetMonth: string) => `/financeiro?month=${targetMonth}&tab=${tab}`;
  const tabs = [
    { id: "overview", label: "Visão geral", href: tabHref("overview") },
    { id: "receivable", label: "Contas a receber", href: tabHref("receivable") },
    { id: "payable", label: "Contas a pagar", href: tabHref("payable") },
    { id: "commissions", label: "Comissões", href: tabHref("commissions") },
    { id: "rates", label: "Formas de pagamento", href: tabHref("rates") },
    { id: "catalog", label: "Catálogo e preços", href: tabHref("catalog") },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Serviço em campo"
        title="Financeiro"
        description={humanMonth(month)}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={monthHref(offsetMonth(month, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href={`/financeiro?tab=${tab}`}
              className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Mês atual
            </Link>
            <Link
              href={monthHref(offsetMonth(month, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="space-y-6 p-6 md:p-8">
        <PageTabs items={tabs} activeId={tab} label="Seções do financeiro" />

        {tab === "overview" && (
        <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
              <p className={`mt-1 text-xl font-semibold ${card.tone}`}>
                {formatCurrencyBRL(card.value)}
              </p>
            </div>
          ))}
        </div>

        {recurringPay > 0 && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-4 py-2.5 text-sm text-info">
            <Repeat className="h-4 w-4" />
            <span>
              Contas fixas já comprometem{" "}
              <strong>{formatCurrencyBRL(recurringPay)}</strong> em{" "}
              {humanMonth(offsetMonth(month, 1))}.
            </span>
          </div>
        )}
        </>
        )}

        {tab === "receivable" && <EntriesPanel kind="receber" entries={toReceive} today={today} />}
        {tab === "payable" && <EntriesPanel kind="pagar" entries={toPay} today={today} />}
        {tab === "commissions" && <CommissionsPanel commissions={commissionRows} rules={ruleMap} sellers={sellers} isOwner={ctx.role === "owner"} />}
        {tab === "rates" && <PaymentRatesPanel rates={(paymentRates ?? []) as PaymentMethodRate[]} />}
        {tab === "catalog" && <ServiceCatalogPanel items={(catalogItems ?? []) as ServiceCatalogItem[]} />}
      </div>
    </div>
  );
}
