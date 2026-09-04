import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canViewServiceRoutes } from "@/lib/auth/roles";
import { formatCurrencyBRL } from "@/lib/utils";
import { SERVICE_ORDER_SHIFT_LABEL, formatServiceOrderCode } from "@/lib/field-service/status";
import { brtDay } from "@/lib/field-service/agenda";
import { PrintOnOpen } from "../../[id]/print/print-on-open";

function formatAddress(order: any) {
  const street = [order.address_street, order.address_number].filter(Boolean).join(", ");
  const rest = [order.address_district, order.address_city].filter(Boolean).join(" · ");
  return [street, rest].filter(Boolean).join(" — ") || "Endereço não informado";
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Impressao do roteiro do dia: varias OS na mesma folha (3 por pagina,
 * retrato), pra levar no carro sem gastar uma folha por cliente. Isso e um
 * roteiro de consulta, nao o documento que o cliente assina - sem area de
 * assinatura de proposito (a assinatura de verdade e digital, coletada no
 * app de campo).
 */
export default async function RoteiroPrintPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) notFound();
  if (!canViewServiceRoutes(ctx.role)) notFound();

  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day ?? "") ? params!.day! : brtDay();

  const supabase = createServiceClient();

  const { data: orders } = await supabase
    .from("service_orders")
    .select("*, leads(name, phone)")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", day)
    .not("status", "in", "(cancelada,rascunho)")
    .order("route_position", { ascending: true, nullsFirst: false });

  const rows = (orders ?? []) as any[];

  const technicianIds = [
    ...new Set(rows.flatMap((o) => [o.consultant_id, o.consultant_extra_id]).filter(Boolean)),
  ] as string[];
  const { data: assignments } = rows.length
    ? await supabase
        .from("service_order_technicians")
        .select("service_order_id, user_id")
        .in("service_order_id", rows.map((o) => o.id))
    : { data: [] };
  const allUserIds = [
    ...new Set([...technicianIds, ...(assignments ?? []).map((a: any) => a.user_id)]),
  ];
  const { data: profiles } = allUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", allUserIds)
    : { data: [] };
  const nameById = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p.full_name]));
  const techniciansByOrder = new Map<string, string[]>();
  for (const a of (assignments ?? []) as any[]) {
    const list = techniciansByOrder.get(a.service_order_id) ?? [];
    const name = nameById.get(a.user_id);
    if (name) list.push(name);
    techniciansByOrder.set(a.service_order_id, list);
  }

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-slate-950 print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page { size: portrait; margin: 1.2cm; }
        @media print {
          .os-print-card { break-inside: avoid; }
          .os-print-card:nth-of-type(3n) { break-after: page; }
        }
      `}</style>

      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/os/roteiro?day=${day}`} className="text-sm text-slate-600 hover:text-slate-950">
          Voltar ao roteiro
        </Link>
        <PrintOnOpen />
      </div>

      <header className="mb-4 print:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{ctx.tenant.name}</p>
        <h1 className="mt-1 text-xl font-bold">Roteiro — {formatDate(day)}</h1>
        <p className="mt-1 text-sm text-slate-600">{rows.length} ordem(ns) de serviço</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma OS agendada pra esse dia.</p>
      ) : (
        rows.map((row) => (
          <section
            key={row.id}
            className="os-print-card mb-4 rounded-lg border border-slate-300 p-4 text-sm"
          >
            <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-base font-bold">{formatServiceOrderCode(row.code_seq)}</h2>
              <span className="text-xs text-slate-600">
                {row.shift ? SERVICE_ORDER_SHIFT_LABEL[row.shift as "manha" | "tarde"] : "Sem turno"}
                {row.scheduled_start_at
                  ? ` · ${new Date(row.scheduled_start_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Cliente</p>
                <p className="font-medium">{row.leads?.name ?? "Lead removido"}</p>
                {row.leads?.phone && <p className="text-xs text-slate-600">{row.leads.phone}</p>}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Endereço</p>
                <p className="text-xs">{formatAddress(row)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Técnico</p>
                <p className="text-xs">{(techniciansByOrder.get(row.id) ?? []).join(" + ") || "Não alocado"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Serviço / Valor</p>
                <p className="text-xs">{row.service_type === "assistencia" ? "Assistência" : formatCurrencyBRL(row.total_cents)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Vendedora</p>
                <p className="text-xs">
                  {nameById.get(row.consultant_id) ?? "—"}
                  {row.consultant_extra_id && nameById.get(row.consultant_extra_id)
                    ? ` + ${nameById.get(row.consultant_extra_id)}`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-slate-500">Loja / Parceiro</p>
                <p className="text-xs">
                  {row.partner_store || "—"}
                  {row.partner_seller_name ? ` · ${row.partner_seller_name}` : ""}
                </p>
                {row.partner_extra_name && (
                  <p className="text-xs text-slate-600">
                    Extra: {row.partner_extra_name}
                    {row.partner_extra_percent != null ? ` (${String(row.partner_extra_percent).replace(".", ",")}%)` : ""}
                  </p>
                )}
              </div>
            </div>

            {row.observations && (
              <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-700">{row.observations}</p>
            )}
          </section>
        ))
      )}
    </main>
  );
}
