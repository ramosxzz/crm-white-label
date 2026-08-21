import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canAccessServiceOrders, canCreateServiceOrder, isTechnician as isTechnicianRole } from "@/lib/auth/roles";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  SALE_CHANNEL_LABEL,
  formatServiceOrderCode,
} from "@/lib/field-service/status";
import { PrintOnOpen } from "./print-on-open";

function formatAddress(order: any) {
  const street = [order.address_street, order.address_number].filter(Boolean).join(", ");
  const rest = [order.address_complement, order.address_district, order.address_city, order.address_state]
    .filter(Boolean)
    .join(" · ");
  return [street, rest].filter(Boolean).join(" — ") || "Endereço não informado";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default async function ServiceOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) notFound();
  if (!canAccessServiceOrders(ctx.role) && !canCreateServiceOrder(ctx.role) && !isTechnicianRole(ctx.role)) notFound();

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("service_orders")
    .select("*, leads(name, phone)")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await supabase
    .from("service_order_items")
    .select("*")
    .eq("service_order_id", id)
    .order("created_at", { ascending: true });

  const { data: assignments } = await supabase
    .from("service_order_technicians")
    .select("user_id")
    .eq("service_order_id", id);
  const userIds = [
    ...new Set([...(assignments ?? []).map((a: any) => a.user_id), order.consultant_id, order.consultant_extra_id].filter(Boolean)),
  ] as string[];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p.full_name]));
  const technicianNames = ((assignments ?? []) as any[]).map((a) => nameById.get(a.user_id)).filter(Boolean);

  const row = order as any;

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-slate-950 sm:px-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/os/${id}`} className="text-sm text-slate-600 hover:text-slate-950">
          Voltar à OS
        </Link>
        <PrintOnOpen />
      </div>

      <header className="mb-6 border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ctx.tenant.name}</p>
        <h1 className="mt-1 text-2xl font-bold">{formatServiceOrderCode(row.code_seq)}</h1>
        <p className="mt-1 text-sm text-slate-600">Gerado em {formatDateTime(new Date().toISOString())}</p>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Loja / Parceiro</p>
          <p>{row.partner_store || "—"}</p>
          {row.partner_seller_name && <p className="text-xs text-slate-600">Vendedor: {row.partner_seller_name}</p>}
          {row.partner_extra_name && <p className="text-xs text-slate-600">Extra: {row.partner_extra_name}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Origem do cliente</p>
          <p>{row.sale_channel ? SALE_CHANNEL_LABEL[row.sale_channel] : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Técnico</p>
          <p>{technicianNames.length > 0 ? technicianNames.join(" + ") : "Não alocado"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Consultor(a)</p>
          <p>
            {nameById.get(row.consultant_id) ?? "—"}
            {row.consultant_extra_id ? ` + ${nameById.get(row.consultant_extra_id)}` : ""}
          </p>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Cliente</p>
          <p className="font-medium">{row.leads?.name ?? "Lead removido"}</p>
          {row.leads?.phone && <p className="text-xs text-slate-600">{row.leads.phone}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Endereço</p>
          <p>{formatAddress(row)}</p>
        </div>
      </section>

      <section className="mb-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Peças / Serviço</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1">Qtd</th>
              <th className="py-1">Descrição</th>
              <th className="py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item: any) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-1">{item.quantity}×</td>
                <td className="py-1">
                  {item.description}
                  {item.kind === "upsell" && <span className="ml-1 text-xs text-slate-500">(extra)</span>}
                </td>
                <td className="py-1 text-right tabular-nums">{formatCurrencyBRL(item.amount_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Deslocamento</p>
          <p>{formatCurrencyBRL(row.travel_fee_cents ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Valor final</p>
          <p className="font-semibold">{formatCurrencyBRL(row.total_cents)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Forma de pagamento</p>
          <p>{row.payment_method || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Previsto / Recebido</p>
          <p>
            {formatCurrencyBRL(row.expected_receipt_cents ?? row.total_cents)} / {formatCurrencyBRL(row.received_cents ?? 0)}
          </p>
        </div>
      </section>

      {row.observations && (
        <section className="mb-5 border-t border-slate-200 pt-4">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Observações</p>
          <p className="whitespace-pre-wrap text-sm">{row.observations}</p>
        </section>
      )}

      <section className="mb-5 border-t border-slate-200 pt-4 text-sm">
        <p className="text-xs font-semibold uppercase text-slate-500">Agenda</p>
        <p>
          {formatDate(row.service_date) ?? "Não agendada"}
          {row.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[row.shift as "manha" | "tarde"]}` : ""}
          {row.scheduled_start_at && row.scheduled_end_at
            ? ` · ${formatDateTime(row.scheduled_start_at)?.split(" ")[1]} → ${formatDateTime(row.scheduled_end_at)?.split(" ")[1]}`
            : ""}
        </p>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-8 border-t border-slate-200 pt-8 text-sm">
        <div className="border-t border-slate-400 pt-2 text-center text-xs text-slate-500">Assinatura do cliente</div>
        <div className="border-t border-slate-400 pt-2 text-center text-xs text-slate-500">Assinatura do técnico</div>
      </section>
    </main>
  );
}
