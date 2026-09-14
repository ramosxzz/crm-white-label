import Link from "next/link";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SALE_CHANNEL_LABEL,
  SERVICE_ORDER_SHIFT_LABEL,
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

export function LegacyServiceOrderPrint({
  id,
  tenantName,
  row,
  items,
  technicianNames,
  nameById,
}: {
  id: string;
  tenantName: string;
  row: any;
  items: any[];
  technicianNames: string[];
  nameById: Map<string, string>;
}) {
  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-slate-950 sm:px-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/os/${id}`} className="text-sm text-slate-600 hover:text-slate-950">Voltar à OS</Link>
        <PrintOnOpen />
      </div>

      <header className="mb-6 border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{tenantName}</p>
        <h1 className="mt-1 text-2xl font-bold">{formatServiceOrderCode(row.code_seq)}</h1>
        <p className="mt-1 text-sm text-slate-600">Gerado em {formatDateTime(new Date().toISOString())}</p>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Loja / Parceiro</p><p>{row.partner_store || "—"}</p>{row.partner_seller_name && <p className="text-xs text-slate-600">Vendedor: {row.partner_seller_name}</p>}{row.partner_extra_name && <p className="text-xs text-slate-600">Extra: {row.partner_extra_name}</p>}</div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Origem do cliente</p><p>{row.sale_channel ? SALE_CHANNEL_LABEL[row.sale_channel] : "—"}</p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Técnico</p><p>{technicianNames.length > 0 ? technicianNames.join(" + ") : "Não alocado"}</p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Consultor(a)</p><p>{nameById.get(row.consultant_id) ?? "—"}{row.consultant_extra_id ? ` + ${nameById.get(row.consultant_extra_id)}` : ""}</p></div>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Cliente</p><p className="font-medium">{row.leads?.name ?? "Lead removido"}</p>{row.leads?.phone && <p className="text-xs text-slate-600">{row.leads.phone}</p>}</div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Endereço</p><p>{formatAddress(row)}</p></div>
      </section>

      <section className="mb-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Peças / Serviço</p>
        <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-1">Qtd</th><th className="py-1">Descrição</th><th className="py-1 text-right">Valor</th></tr></thead><tbody>
          {items.map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="py-1">{item.quantity}×</td><td className="py-1">{item.description}{item.kind === "upsell" && <span className="ml-1 text-xs text-slate-500">(extra)</span>}</td><td className="py-1 text-right tabular-nums">{formatCurrencyBRL(item.amount_cents)}</td></tr>)}
        </tbody></table>
      </section>

      <section className="mb-5 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Deslocamento</p><p>{formatCurrencyBRL(row.travel_fee_cents ?? 0)}</p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Valor final</p><p className="font-semibold">{formatCurrencyBRL(row.total_cents)}</p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Forma de pagamento</p><p>{row.payment_method || "—"}</p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Previsto / Recebido</p><p>{formatCurrencyBRL(row.expected_receipt_cents ?? row.total_cents)} / {formatCurrencyBRL(row.received_cents ?? 0)}</p></div>
      </section>

      {row.observations && <section className="mb-5 border-t border-slate-200 pt-4"><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Observações</p><p className="whitespace-pre-wrap text-sm">{row.observations}</p></section>}

      <section className="mb-5 border-t border-slate-200 pt-4 text-sm">
        <p className="text-xs font-semibold uppercase text-slate-500">Agenda</p>
        <p>{formatDate(row.service_date) ?? "Não agendada"}{row.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[row.shift as "manha" | "tarde"]}` : ""}{row.scheduled_start_at && row.scheduled_end_at ? ` · ${formatDateTime(row.scheduled_start_at)?.split(" ")[1]} → ${formatDateTime(row.scheduled_end_at)?.split(" ")[1]}` : ""}</p>
      </section>
    </main>
  );
}
