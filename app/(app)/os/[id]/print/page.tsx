import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canAccessServiceOrders, canCreateServiceOrder, isTechnician as isTechnicianRole } from "@/lib/auth/roles";
import { formatCurrencyBRL } from "@/lib/utils";
import { SALE_CHANNEL_LABEL, SERVICE_ORDER_SHIFT_LABEL, formatServiceOrderCode } from "@/lib/field-service/status";
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

  const [{ data: items }, { data: assignments }] = await Promise.all([
    supabase.from("service_order_items").select("*").eq("service_order_id", id).order("created_at", { ascending: true }),
    supabase.from("service_order_technicians").select("user_id").eq("service_order_id", id),
  ]);
  const userIds = [...new Set([
    ...(assignments ?? []).map((assignment: any) => assignment.user_id),
    order.consultant_id,
    order.consultant_extra_id,
    order.confirmed_by,
    order.created_by,
    order.reviewed_by,
  ].filter(Boolean))] as string[];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const nameById = new Map(((profiles ?? []) as any[]).map((profile) => [profile.id, profile.full_name]));
  const technicianNames = ((assignments ?? []) as any[]).map((assignment) => nameById.get(assignment.user_id)).filter(Boolean);
  const row = order as any;

  return (
    <main className="mx-auto max-w-4xl bg-white px-5 py-6 text-[11px] leading-tight text-slate-950 sm:px-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-5 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/os/${id}`} className="text-sm text-slate-600 hover:text-slate-950">Voltar à OS</Link>
        <PrintOnOpen />
      </div>

      <header className="mb-2 flex items-end justify-between border-b-2 border-slate-950 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ordem de serviço</p>
          <h1 className="text-xl font-black uppercase tracking-tight">{ctx.tenant.name}</h1>
        </div>
        <div className="text-right">
          <p className="text-lg font-black">{formatServiceOrderCode(row.code_seq)}</p>
          <p className="text-[9px] text-slate-500">Impresso em {formatDateTime(new Date().toISOString())}</p>
        </div>
      </header>

      <section className="mb-2 grid grid-cols-3 border border-slate-950">
        <div className="border-r border-slate-950 p-2">
          <p className="text-[9px] font-bold uppercase text-slate-500">Loja / parceiro</p>
          <p className="font-bold uppercase">{row.partner_store || "—"}</p>
          {row.partner_seller_name && <p>Vendedor: {row.partner_seller_name}</p>}
          {row.partner_extra_name && <p>Extra: {row.partner_extra_name}</p>}
        </div>
        <div className="border-r border-slate-950 p-2">
          <p className="text-[9px] font-bold uppercase text-slate-500">Técnico</p>
          <p className="font-bold uppercase">{technicianNames.length > 0 ? technicianNames.join(" + ") : "Não alocado"}</p>
          <p className="mt-1 text-[9px] text-slate-500">Voltagem</p>
          <p className="font-semibold">{row.voltage || "Não informada"}</p>
        </div>
        <div className="p-2">
          <p className="text-[9px] font-bold uppercase text-slate-500">Consultor(a) / origem</p>
          <p className="font-bold uppercase">
            {nameById.get(row.consultant_id) ?? "—"}
            {row.consultant_extra_id ? ` + ${nameById.get(row.consultant_extra_id)}` : ""}
          </p>
          <p className="mt-1">{row.sale_channel ? SALE_CHANNEL_LABEL[row.sale_channel] : "Origem não informada"}</p>
        </div>
      </section>

      <section className="mb-2 grid grid-cols-[1fr_1.6fr] border border-slate-950">
        <div className="border-r border-slate-950 p-2">
          <p className="text-[9px] font-bold uppercase text-slate-500">Dados do cliente</p>
          <p className="text-sm font-black uppercase">{row.leads?.name ?? "Lead removido"}</p>
          {row.leads?.phone && <p className="font-semibold">{row.leads.phone}</p>}
        </div>
        <div className="p-2">
          <p className="text-[9px] font-bold uppercase text-slate-500">Endereço</p>
          <p className="font-semibold uppercase">{formatAddress(row)}</p>
          {row.address_cep && <p>CEP {row.address_cep}</p>}
        </div>
      </section>

      <section className="mb-2 break-inside-avoid border border-slate-950">
        <p className="border-b border-slate-950 bg-slate-100 px-2 py-1 text-center text-[10px] font-black uppercase">Peças / serviços</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-950 text-left text-[9px] uppercase text-slate-500">
              <th className="w-14 px-2 py-1">Qtd</th><th className="px-2 py-1">Descrição</th><th className="w-28 px-2 py-1 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item: any) => (
              <tr key={item.id} className="border-b border-slate-300 last:border-0">
                <td className="px-2 py-1">{item.quantity}×</td>
                <td className="px-2 py-1 font-semibold uppercase">
                  {item.description}{item.kind === "upsell" && <span className="ml-1 text-[9px] text-slate-500">(extra)</span>}
                </td>
                <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatCurrencyBRL(item.amount_cents)}</td>
              </tr>
            ))}
            {(items ?? []).length === 0 && <tr><td colSpan={3} className="px-2 py-4 text-center text-slate-500">Nenhum item cadastrado</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="mb-2 grid break-inside-avoid grid-cols-[1.3fr_1fr] border border-slate-950">
        <div className="border-r border-slate-950 p-2">
          <p className="mb-2 text-center text-[10px] font-black uppercase">Negociação</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <dt>Serviços e peças</dt><dd className="font-semibold tabular-nums">{formatCurrencyBRL(Math.max(0, row.total_cents - (row.travel_fee_cents ?? 0)))}</dd>
            <dt>Deslocamento</dt><dd className="font-semibold tabular-nums">{formatCurrencyBRL(row.travel_fee_cents ?? 0)}</dd>
            <dt className="border-t border-slate-400 pt-1 font-bold">Valor final</dt><dd className="border-t border-slate-400 pt-1 font-black tabular-nums">{formatCurrencyBRL(row.total_cents)}</dd>
          </dl>
        </div>
        <div className="p-2">
          <p className="mb-2 text-center text-[10px] font-black uppercase">Recebimento</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <dt>Pagamento</dt><dd className="font-semibold uppercase">{row.payment_method || "—"}</dd>
            <dt>Previsto</dt><dd className="font-semibold tabular-nums">{formatCurrencyBRL(row.expected_receipt_cents ?? row.total_cents)}</dd>
            <dt>Recebido</dt><dd className="font-semibold tabular-nums">{formatCurrencyBRL(row.received_cents ?? 0)}</dd>
          </dl>
        </div>
      </section>

      <section className="mb-2 grid min-h-28 break-inside-avoid grid-cols-[1.6fr_1fr] border border-slate-950">
        <div className="border-r border-slate-950 p-2">
          <p className="mb-1 text-[10px] font-black uppercase">Observações</p>
          <p className="whitespace-pre-wrap font-semibold uppercase">{row.observations || row.notes || "Sem observações"}</p>
        </div>
        <div className="p-2">
          <p className="mb-1 text-[10px] font-black uppercase">Confirmação / auditoria</p>
          <p>{row.confirmed_at ? `Confirmada com ${row.confirmed_contact_name || row.leads?.name || "cliente"}` : "Aguardando confirmação"}</p>
          {row.confirmed_at && <p>Em {formatDateTime(row.confirmed_at)}</p>}
          {row.confirmed_by && <p>Por {nameById.get(row.confirmed_by) || "usuário do sistema"}</p>}
          <p className="mt-2">Criada por {nameById.get(row.created_by) || "usuário do sistema"}</p>
          <p>Em {formatDateTime(row.created_at)}</p>
          {row.reviewed_by && <p>Conferida por {nameById.get(row.reviewed_by)}</p>}
        </div>
      </section>

      <section className="flex break-inside-avoid items-center justify-between border-y-2 border-slate-950 px-2 py-2 text-sm font-black">
        <span>
          Início: {formatDate(row.service_date) ?? "Não agendada"} {row.scheduled_start_at ? formatDateTime(row.scheduled_start_at)?.split(" ")[1] : row.shift ? SERVICE_ORDER_SHIFT_LABEL[row.shift as "manha" | "tarde"] : ""}
        </span>
        <span>Fim: {row.scheduled_end_at ? formatDateTime(row.scheduled_end_at)?.split(" ")[1] : "—"}</span>
      </section>

      <style>{`@media print { @page { size: A4; margin: 8mm; } body { background: white !important; } }`}</style>
    </main>
  );
}
