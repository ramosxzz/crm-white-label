import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canViewServiceRoutes } from "@/lib/auth/roles";
import { formatCurrencyBRL } from "@/lib/utils";
import { SALE_CHANNEL_LABEL } from "@/lib/field-service/status";
import { brtDay } from "@/lib/field-service/agenda";
import { PrintOnOpen } from "../../[id]/print/print-on-open";

function formatAddress(order: any) {
  const street = [order.address_street, order.address_number].filter(Boolean).join(", ");
  const rest = [order.address_district].filter(Boolean).join(" · ");
  return [street, rest].filter(Boolean).join(" — ") || "Endereço não informado";
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

/**
 * Impressao do roteiro do dia, no molde exato da ficha em papel que o ACT
 * usava no sistema antigo: uma caixa por OS, com os mesmos campos e a mesma
 * disposicao (loja/parceiro, tecnico/consultora/canal, dados do cliente,
 * pecas, valores, conferencia em branco pra anotar a mao, observacoes,
 * horario e confirmacao).
 *
 * Campos que a ficha antiga tinha e o sistema nao rastreia em lugar nenhum
 * hoje (por isso saem em branco): CPF/CNPJ do cliente, endereco da loja
 * parceira, e a quebra de tabela por categoria (Imper/Lavagem/Couro) - o
 * sistema so guarda um total, nao por categoria de servico.
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
    .select("*, leads(id, name, phone, created_at)")
    .eq("tenant_id", ctx.tenantId)
    .eq("service_date", day)
    .not("status", "in", "(cancelada,rascunho)")
    .order("route_position", { ascending: true, nullsFirst: false });

  const rows = (orders ?? []) as any[];

  const userIds = [
    ...new Set(rows.flatMap((o) => [o.consultant_id, o.consultant_extra_id]).filter(Boolean)),
  ] as string[];
  const [{ data: assignments }, { data: profiles }, { data: allItems }, { data: confirmerProfiles }] = await Promise.all([
    rows.length
      ? supabase.from("service_order_technicians").select("service_order_id, user_id").in("service_order_id", rows.map((o) => o.id))
      : Promise.resolve({ data: [] }),
    userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    rows.length ? supabase.from("service_order_items").select("*").in("service_order_id", rows.map((o) => o.id)) : Promise.resolve({ data: [] }),
    rows.length && rows.some((o) => o.confirmed_by)
      ? supabase.from("profiles").select("id, full_name").in("id", rows.map((o) => o.confirmed_by).filter(Boolean))
      : Promise.resolve({ data: [] }),
  ]);

  const technicianUserIds = [...new Set((assignments ?? []).map((a: any) => a.user_id))];
  const { data: technicianProfiles } = technicianUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", technicianUserIds)
    : { data: [] };

  const nameById = new Map(
    [...(profiles ?? []), ...(technicianProfiles ?? []), ...(confirmerProfiles ?? [])].map((p: any) => [p.id, p.full_name]),
  );
  const techniciansByOrder = new Map<string, string[]>();
  for (const a of (assignments ?? []) as any[]) {
    const list = techniciansByOrder.get(a.service_order_id) ?? [];
    const name = nameById.get(a.user_id);
    if (name) list.push(name);
    techniciansByOrder.set(a.service_order_id, list);
  }
  const itemsByOrder = new Map<string, any[]>();
  for (const item of (allItems ?? []) as any[]) {
    const list = itemsByOrder.get(item.service_order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.service_order_id, list);
  }

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-slate-950 print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page { size: portrait; margin: 1cm; }
        @media print {
          .os-print-card { break-inside: avoid; break-after: page; }
          .os-print-card:last-child { break-after: auto; }
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
        rows.map((row) => {
          const items = itemsByOrder.get(row.id) ?? [];
          const itemsTotal = items
            .filter((i) => i.approved && !["solicitado", "recusado"].includes(i.discount_status))
            .reduce((sum, i) => sum + i.amount_cents, 0);
          const techNames = techniciansByOrder.get(row.id) ?? [];
          const consultantName = nameById.get(row.consultant_id) ?? "";
          const consultantExtraName = row.consultant_extra_id ? nameById.get(row.consultant_extra_id) : null;

          return (
            <section key={row.id} className="os-print-card mb-4 border border-slate-950 text-[11px]">
              {/* Cabecalho da empresa */}
              <div className="flex items-center justify-between border-b border-slate-950 px-2 py-1">
                <p className="text-xs font-bold uppercase">{ctx.tenant.name}</p>
                <p className="text-[10px]">
                  {ctx.tenant.phone ? `Telefone: ${ctx.tenant.phone}` : ""}
                  {ctx.tenant.field_service_base_address ? ` — ${ctx.tenant.field_service_base_address}` : ""}
                </p>
              </div>

              {/* Loja/Parceiro */}
              <div className="border-b border-slate-950 px-2 py-1">
                <span className="font-semibold">Loja\Parceiro:</span>{" "}
                {row.partner_store || "—"}
                {row.partner_seller_name ? ` \\ ${row.partner_seller_name}` : ""}
              </div>

              {/* Tecnico / Consultora / Canal */}
              <div className="grid grid-cols-3 border-b border-slate-950">
                <div className="border-r border-slate-950 px-2 py-1">
                  <span className="font-semibold">Técnico:</span> {techNames.join(" + ") || "Não alocado"}
                </div>
                <div className="border-r border-slate-950 px-2 py-1">
                  <span className="font-semibold">Consultor(a):</span>{" "}
                  {consultantName}
                  {consultantExtraName ? ` + ${consultantExtraName}` : ""}
                </div>
                <div className="px-2 py-1">
                  <span className="font-semibold">Canal de Vendas:</span>{" "}
                  {row.sale_channel ? SALE_CHANNEL_LABEL[row.sale_channel as keyof typeof SALE_CHANNEL_LABEL] ?? row.sale_channel : "—"}
                </div>
              </div>

              <div className="grid grid-cols-2">
                {/* Coluna esquerda: dados do cliente + pecas */}
                <div className="border-r border-slate-950">
                  <div className="border-b border-slate-950 px-2 py-1">
                    <span className="font-semibold">Voltagem:</span> {row.voltage ?? "—"}
                    {" | "}
                    <span className="font-semibold">Data cadastro:</span>{" "}
                    {row.leads?.created_at ? new Date(row.leads.created_at).toLocaleDateString("pt-BR") : "—"}
                  </div>
                  <div className="border-b border-slate-950 px-2 py-1">
                    <span className="font-semibold">Nome:</span> {row.leads?.name ?? "Lead removido"}
                  </div>
                  <div className="border-b border-slate-950 px-2 py-1">
                    <span className="font-semibold">Fone(s):</span> {row.leads?.phone ?? "—"}
                  </div>
                  <div className="border-b border-slate-950 px-2 py-1 text-slate-400">
                    <span className="font-semibold text-slate-500">CPF/CNPJ:</span> não cadastrado
                  </div>
                  <div className="p-2">
                    <p className="mb-1 font-semibold">Peças:</p>
                    {items.length === 0 ? (
                      <p className="text-slate-500">Nenhuma peça lançada.</p>
                    ) : (
                      items.map((item) => (
                        <p key={item.id}>
                          {item.quantity}x {item.description} — {formatCurrencyBRL(item.amount_cents)}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                {/* Coluna direita: endereço + valores */}
                <div>
                  <div className="relative border-b border-slate-950 px-2 py-1">
                    <p className="font-semibold uppercase">Dados do cliente</p>
                    <p>
                      <span className="font-semibold">Endereço:</span> {formatAddress(row)}
                      {row.address_city ? `, ${row.address_city}-${row.address_state ?? ""}` : ""}
                      {row.address_cep ? ` - CEP ${row.address_cep}` : ""}
                    </p>
                    {row.address_city && (
                      <span className="absolute right-1 top-1 rounded-sm bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                        {row.address_city}
                      </span>
                    )}
                  </div>
                  <div className="border-b border-slate-950 p-2">
                    <p className="mb-1 font-semibold uppercase">
                      Serviço: {row.service_type === "assistencia" ? "Assistência" : "Impermeabilização / Lavagem"}
                    </p>
                    <div className="grid grid-cols-2 gap-x-2">
                      <span>Valor Inicial (R$):</span>
                      <span className="text-right">{formatCurrencyBRL(itemsTotal)}</span>
                      <span>Valor Deslocamento:</span>
                      <span className="text-right">{formatCurrencyBRL(row.travel_fee_cents ?? 0)}</span>
                      <span className="font-semibold">Valor Final (R$):</span>
                      <span className="text-right font-semibold">{formatCurrencyBRL(row.total_cents)}</span>
                    </div>
                    {row.payment_method && (
                      <span className="mt-1 inline-block rounded-sm bg-slate-950 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        {row.payment_method}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2">
                    <div className="border-r border-slate-950 p-2">
                      <p className="mb-6 font-semibold uppercase">Conferência</p>
                    </div>
                    <div className="p-2">
                      <p className="mb-1 font-semibold uppercase">Observações</p>
                      <p className="whitespace-pre-wrap">{row.observations || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodape: horario e confirmacao */}
              <div className="border-t border-slate-950 px-2 py-1 text-[10px]">
                <span className="font-semibold">Data Início:</span> {formatDate(row.service_date)} - {formatTime(row.scheduled_start_at) ?? "—"}h
                {" "}
                <span className="font-semibold">Fim:</span> {formatTime(row.scheduled_end_at) ?? "—"}h
                {" · "}
                {row.confirmed_at ? (
                  <>
                    <span className="font-semibold">Confirmado em:</span> {formatDateTime(row.confirmed_at)}
                    {row.confirmed_contact_name ? ` com ${row.confirmed_contact_name}` : ""}
                    {row.confirmed_by && nameById.get(row.confirmed_by) ? ` (${nameById.get(row.confirmed_by)})` : ""}
                  </>
                ) : (
                  <span className="text-slate-500">Ainda não confirmado com o cliente</span>
                )}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
