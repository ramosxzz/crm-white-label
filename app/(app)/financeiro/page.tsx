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
} from "@/lib/supabase/database.types";
import { CommissionsPanel, type CommissionRow } from "./commissions-panel";
import { EntriesPanel } from "./entries-panel";

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
  searchParams?: Promise<{ month?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");
  // Resposta 18 do briefing: financeiro nao e de todo mundo.
  if (!canReviewServiceOrder(ctx.role)) redirect("/dashboard");

  const params = await searchParams;
  const today = brtToday();
  const month = /^\d{4}-\d{2}$/.test(params?.month ?? "") ? params!.month! : monthOf(today);
  const { start, end } = monthRange(month);

  const supabase = await createClient();

  const [{ data: entries }, { data: recurring }, { data: commissions }, { data: rules }] =
    await Promise.all([
      supabase
        .from("finance_entries")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .gte("due_date", start)
        .lt("due_date", end)
        .order("due_date", { ascending: true }),
      // Contas fixas alimentam a projecao do mes seguinte ("temos contas para
      // o proximo mes e isso ja deixar fixado").
      supabase
        .from("finance_entries")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_recurring", true),
      supabase
        .from("commissions")
        .select("*, service_orders(code_seq)")
        .eq("tenant_id", ctx.tenantId)
        .gte("created_at", `${start}T00:00:00-03:00`)
        .lt("created_at", `${end}T00:00:00-03:00`)
        .order("created_at", { ascending: false }),
      supabase.from("commission_rules").select("party_kind, percent").eq("tenant_id", ctx.tenantId),
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

  const users = await listTenantUserOptions(ctx.tenantId);
  const nameById = new Map(users.map((user) => [user.id, user.name]));

  const commissionRows: CommissionRow[] = ((commissions ?? []) as any[]).map((row) => ({
    id: row.id,
    party_kind: row.party_kind as CommissionParty,
    who: row.user_id ? (nameById.get(row.user_id) ?? "Usuário") : (row.partner_name ?? "Parceiro"),
    base_cents: row.base_cents,
    percent: Number(row.percent),
    amount_cents: row.amount_cents,
    status: row.status as CommissionStatus,
    order_code: row.service_orders?.code_seq ?? null,
  }));

  const ruleMap: Record<CommissionParty, number> = {
    tecnico: 0,
    vendedora_interna: 0,
    loja_parceira: 0,
  };
  for (const rule of (rules ?? []) as Array<{ party_kind: CommissionParty; percent: number }>) {
    ruleMap[rule.party_kind] = Number(rule.percent);
  }

  const cards = [
    { label: "Recebido no mês", value: received, tone: "text-success" },
    { label: "Pago no mês", value: paid, tone: "text-destructive" },
    { label: "Saldo", value: received - paid, tone: received - paid >= 0 ? "text-success" : "text-destructive" },
    { label: "Em aberto (receber − pagar)", value: openToReceive - openToPay, tone: "text-foreground" },
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
              href={`/financeiro?month=${offsetMonth(month, -1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/financeiro"
              className="rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              Mês atual
            </Link>
            <Link
              href={`/financeiro?month=${offsetMonth(month, 1)}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 transition-colors hover:bg-muted/50"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="space-y-6 p-8">
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

        <div className="grid gap-6 xl:grid-cols-2">
          <EntriesPanel kind="receber" entries={toReceive} today={today} />
          <EntriesPanel kind="pagar" entries={toPay} today={today} />
        </div>

        <CommissionsPanel commissions={commissionRows} rules={ruleMap} />
      </div>
    </div>
  );
}
