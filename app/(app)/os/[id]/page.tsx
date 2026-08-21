import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, Plug, Printer, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  canAccessServiceOrders,
  canApproveServiceOrderDiscount,
  canManageServiceOrders,
  canReopenServiceOrder,
  canReviewServiceOrder,
  isTechnician as isTechnicianRole,
} from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { SERVICE_REPORT_CHECKLIST } from "@/lib/field-service/checklist";
import {
  SALE_CHANNEL_LABEL,
  SERVICE_ORDER_SHIFT_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
  formatServiceOrderCode,
  isServiceOrderLocked,
} from "@/lib/field-service/status";
import { listTechnicians, listConsultants } from "@/lib/field-service/users";
import type {
  ServiceOrderItem,
  ServiceOrderQuote,
  ServiceOrderShift,
  ServiceOrderStatus,
  PaymentMethodRate,
  FinancialAdjustmentRequest,
  ServiceCatalogItem,
  CommissionParty,
} from "@/lib/supabase/database.types";
import { ServiceOrderStatusBadge } from "../status-badge";
import { ItemsPanel } from "./items-panel";
import { SchedulePanel } from "./schedule-panel";
import { StatusActions } from "./status-actions";
import { ServiceOrdersLive } from "../service-orders-live";
import { QuotesPanel } from "./quotes-panel";
import { SettlementPanel } from "./settlement-panel";
import { FollowupsPanel, type FollowupRow } from "./followups-panel";
import { CommissionsPanel, type CommissionRow } from "./commissions-panel";
import { CreateReapplicationButton } from "./create-reapplication-button";

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

export default async function ServiceOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.field_service_enabled) notFound();
  if (!canAccessServiceOrders(ctx.role) && !isTechnicianRole(ctx.role)) notFound();

  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("service_orders")
    .select("*, leads(id, name, phone, email)")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  // Sem linha aqui pode ser OS inexistente ou bloqueada pela RLS - nos dois
  // casos o usuario nao deve saber a diferenca.
  if (!order) notFound();

  const [
    { data: items },
    { data: assigned },
    { data: damages },
    { data: events },
    { data: paymentRates },
    { data: adjustmentRequests },
    { data: catalogItems },
    { data: checklist },
    { data: quotes },
    { data: relatedOrders },
    { data: followups },
  ] = await Promise.all([
    supabase
      .from("service_order_items")
      .select("*")
      .eq("service_order_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("service_order_technicians").select("user_id, is_primary").eq("service_order_id", id),
    supabase
      .from("service_order_damages")
      .select("*")
      .eq("service_order_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("service_order_events")
      .select("*")
      .eq("service_order_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payment_method_rates")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("name"),
    supabase
      .from("financial_adjustment_requests")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("service_order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_catalog_items")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("category")
      .order("name"),
    supabase
      .from("service_order_checklists")
      .select("*")
      .eq("service_order_id", id)
      .maybeSingle(),
    supabase
      .from("service_order_quotes")
      .select("*")
      .eq("service_order_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("service_orders")
      .select("id, code_seq, status, service_date, origin_service_order_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", order.lead_id)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("service_order_followups")
      .select("*")
      .eq("service_order_id", id)
      .order("contact_date", { ascending: true }),
  ]);

  // Reaplicacao: cliente voltando depois de meses. Mostra resumo + laudo do
  // pedido anterior aqui mesmo, sem precisar clicar pra ir na OS antiga.
  const { data: originOrder } = order.origin_service_order_id
    ? await supabase
        .from("service_orders")
        .select("id, code_seq, service_date, total_cents")
        .eq("id", order.origin_service_order_id)
        .maybeSingle()
    : { data: null };
  const [{ data: originItems }, { data: originChecklist }] = order.origin_service_order_id
    ? await Promise.all([
        supabase
          .from("service_order_items")
          .select("description, quantity, amount_cents")
          .eq("service_order_id", order.origin_service_order_id)
          .order("created_at", { ascending: true }),
        supabase
          .from("service_order_checklists")
          .select("answers, observations")
          .eq("service_order_id", order.origin_service_order_id)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  const canManage = canManageServiceOrders(ctx.role);
  const canReview = canReviewServiceOrder(ctx.role);
  const canReopen = canReopenServiceOrder(ctx.role);
  const canApproveDiscount = canApproveServiceOrderDiscount(ctx.role);
  const isTech = isTechnicianRole(ctx.role);
  const canPriceItems = canManage || ctx.role === "vendedor";
  const technicians = canManage ? await listTechnicians(ctx.tenantId) : [];
  const consultants = canManage ? await listConsultants(ctx.tenantId) : [];

  // Comissao so existe apos faturar, e a leitura e restrita (mesmo corte de
  // /financeiro) - buscar so quando faz sentido evita mostrar "R$0,00"
  // enganoso pra quem nao tem permissao de ver comissao de verdade.
  const { data: commissionsData } =
    canReview && order.status === "faturada"
      ? await supabase
          .from("commissions")
          .select("*")
          .eq("tenant_id", ctx.tenantId)
          .eq("service_order_id", id)
      : { data: [] };

  const pendingCommissionRequestIds = new Set(
    (adjustmentRequests ?? [])
      .filter((r: any) => r.adjustment_kind === "comissao" && r.status === "pendente")
      .map((r: any) => r.commission_id as string),
  );
  const commissions: CommissionRow[] = ((commissionsData ?? []) as any[]).map((c) => ({
    id: c.id,
    partyKind: c.party_kind as CommissionParty,
    partnerName: c.partner_name ?? null,
    amountCents: c.amount_cents,
    status: c.status,
    hasPendingRequest: pendingCommissionRequestIds.has(c.id),
  }));

  const followupRows: FollowupRow[] = ((followups ?? []) as any[]).map((f) => ({
    id: f.id,
    category: f.category,
    responsibleId: f.responsible_id,
    contactDate: f.contact_date,
    description: f.description,
    status: f.status,
  }));

  const assignedIds = (assigned ?? []).map((row: any) => row.user_id as string);
  const technicianNames = technicians
    .filter((tech) => assignedIds.includes(tech.id))
    .map((tech) => tech.name);
  const consultantName = consultants.find((c) => c.id === order.consultant_id)?.name ?? null;
  const consultantExtraName = consultants.find((c) => c.id === order.consultant_extra_id)?.name ?? null;

  const status = order.status as ServiceOrderStatus;
  const locked = isServiceOrderLocked(status);
  const scheduled = formatDate(order.service_date);

  return (
    <div>
      <ServiceOrdersLive tenantId={ctx.tenantId} />
      <PageHeader
        backHref="/os"
        eyebrow="Ordem de serviço"
        title={formatServiceOrderCode(order.code_seq)}
        description={order.leads?.name ?? "Lead removido"}
        actions={
          <div className="flex items-center gap-3">
            <ServiceOrderStatusBadge status={status} />
            {order.service_type === "assistencia" && <Badge variant="info">Sem cobrança</Badge>}
            {order.origin_kind === "reaplicacao" && <Badge variant="brand">Reaplicação</Badge>}
            <Link
              href={`/os/${order.id}/print`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:bg-muted/50"
              aria-label="Imprimir / PDF"
              title="Imprimir / PDF"
            >
              <Printer className="h-4 w-4" />
            </Link>
            {canManage && ["concluida", "conferida", "faturada"].includes(status) && (
              <CreateReapplicationButton originServiceOrderId={order.id} />
            )}
            <StatusActions
              serviceOrderId={order.id}
              status={status}
              canManage={canManage}
              canReview={canReview}
              canReopen={canReopen}
              isTechnician={isTech}
              leadName={order.leads?.name ?? "Lead removido"}
              leadPhone={order.leads?.phone ?? null}
              leadEmail={order.leads?.email ?? null}
              checklist={checklist as { answers: unknown; observations: string | null } | null}
              items={(items ?? []) as ServiceOrderItem[]}
              catalogItems={(catalogItems ?? []) as ServiceCatalogItem[]}
              travelFeeCents={order.travel_fee_cents ?? 0}
              canEditItems={!locked && canPriceItems}
              canApproveDiscount={canApproveDiscount}
              canDeleteItems={canManage && !locked}
            />
          </div>
        }
      />

      <div className="grid gap-6 p-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
            <h2 className="mb-4 text-sm font-semibold">Atendimento</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Cliente</dt>
                <dd className="mt-1 text-sm font-medium">
                  {order.leads?.id ? (
                    <Link href={`/leads/${order.leads.id}`} className="hover:text-brand">
                      {order.leads.name}
                    </Link>
                  ) : (
                    "Lead removido"
                  )}
                </dd>
                {order.leads?.phone && (
                  <dd className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" /> {order.leads.phone}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Endereço</dt>
                <dd className="mt-1 inline-flex items-start gap-1 text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {formatAddress(order)}
                </dd>
                {order.address_cep && (
                  <dd className="mt-0.5 text-xs text-muted-foreground">CEP {order.address_cep}</dd>
                )}
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Voltagem</dt>
                <dd className="mt-1 inline-flex items-center gap-1 text-sm">
                  <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                  {order.voltage ?? "Não informada"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Técnicos</dt>
                <dd className="mt-1 inline-flex items-center gap-1 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {technicianNames.length > 0
                    ? technicianNames.join(", ")
                    : assignedIds.length > 0
                      ? `${assignedIds.length} técnico(s)`
                      : "Nenhum alocado"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Agenda</dt>
                <dd className="mt-1 text-sm">
                  {scheduled
                    ? `${scheduled}${order.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[order.shift as "manha" | "tarde"]}` : ""}`
                    : "Não agendada"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Prazo</dt>
                <dd className="mt-1 text-sm">{formatDate(order.deadline) ?? "Sem prazo"}</dd>
              </div>
              {order.partner_store && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Loja parceira</dt>
                  <dd className="mt-1 text-sm">{order.partner_store}</dd>
                </div>
              )}
              {order.partner_extra_name && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Parceiro extra</dt>
                  <dd className="mt-1 text-sm">
                    {order.partner_extra_name}
                    {order.partner_extra_percent != null ? ` · ${String(order.partner_extra_percent).replace(".", ",")}%` : ""}
                  </dd>
                </div>
              )}
              {order.sale_channel && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Origem do cliente</dt>
                  <dd className="mt-1 text-sm">{SALE_CHANNEL_LABEL[order.sale_channel] ?? order.sale_channel}</dd>
                </div>
              )}
              {(consultantName || consultantExtraName) && (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Consultor(a)</dt>
                  <dd className="mt-1 text-sm">
                    {consultantName ?? "—"}
                    {consultantExtraName ? ` + ${consultantExtraName}` : ""}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Total</dt>
                <dd className="mt-1 text-sm font-semibold">{formatCurrencyBRL(order.total_cents)}</dd>
              </div>
            </dl>

            {order.observations && (
              <div className="mt-4 rounded-lg bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Observações da venda
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{order.observations}</p>
              </div>
            )}
          </section>

          <ItemsPanel
            serviceOrderId={order.id}
            items={(items ?? []) as ServiceOrderItem[]}
            canEdit={!locked && canPriceItems}
            canApprove={canReview}
            canApproveDiscount={canApproveDiscount}
            canDelete={canManage && !locked}
            travelFeeCents={order.travel_fee_cents ?? 0}
            catalogItems={(catalogItems ?? []) as ServiceCatalogItem[]}
          />

          {(damages ?? []).length > 0 && (
            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
              <h2 className="mb-3 text-sm font-semibold">Avarias registradas</h2>
              <ul className="space-y-2">
                {(damages ?? []).map((damage: any) => (
                  <li key={damage.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {damage.description}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {checklist && (
            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
              <h2 className="mb-3 text-sm font-semibold">Laudo técnico</h2>
              <dl className="space-y-2">
                {SERVICE_REPORT_CHECKLIST.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="shrink-0 font-semibold">
                      {(checklist.answers as Record<string, boolean>)[item.key] ? "Sim" : "Não"}
                    </dd>
                  </div>
                ))}
              </dl>
              {checklist.observations && (
                <p className="mt-4 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">
                  {checklist.observations}
                </p>
              )}
            </section>
          )}

          {(quotes ?? []).length > 0 && (
            <QuotesPanel quotes={(quotes ?? []) as ServiceOrderQuote[]} canManage={canManage} />
          )}
        </div>

        <div className="space-y-6">
          {canReview && order.service_type !== "assistencia" && (
            <SettlementPanel
              serviceOrderId={order.id}
              status={status}
              totalCents={order.total_cents}
              expectedCents={order.expected_receipt_cents}
              receivedCents={order.received_cents ?? 0}
              paymentMethod={order.payment_method}
              rates={(paymentRates ?? []) as PaymentMethodRate[]}
              requests={(adjustmentRequests ?? []) as FinancialAdjustmentRequest[]}
              isOwner={ctx.role === "owner"}
            />
          )}

          <CommissionsPanel serviceOrderId={order.id} commissions={commissions} canAdjust={canReview} />

          {canManage && (
            <FollowupsPanel
              serviceOrderId={order.id}
              followups={followupRows}
              consultants={consultants}
              canManage={canManage}
            />
          )}

          {canManage && !locked && (
            <SchedulePanel
              serviceOrderId={order.id}
              technicians={technicians}
              currentDate={order.service_date}
              currentShift={order.shift as ServiceOrderShift | null}
              currentTechnicianIds={assignedIds}
            />
          )}

          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
            <h2 className="mb-3 text-sm font-semibold">Assinatura do cliente</h2>
            {order.signed_at ? (
              <div className="text-sm">
                <p className="font-medium">{order.signer_name ?? "Assinada"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(order.signed_at)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não assinada. A coleta acontece no app do técnico, em campo.
              </p>
            )}
          </section>

          {(order.origin_service_order_id || (relatedOrders ?? []).length > 0) && (
            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
              <h2 className="mb-3 text-sm font-semibold">Histórico do cliente</h2>
              {originOrder && (
                <div className="mb-3 rounded-lg border border-brand/30 bg-brand/5 p-3">
                  <p className="text-xs font-semibold text-brand">
                    Cliente retornando — resumo do último pedido ({formatServiceOrderCode(originOrder.code_seq)}
                    {originOrder.service_date ? `, ${formatDate(originOrder.service_date)}` : ""})
                  </p>
                  {(originItems ?? []).length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {(originItems ?? []).map((it: any, i: number) => (
                        <li key={i} className="flex items-center justify-between gap-2">
                          <span className="truncate">{it.quantity}× {it.description}</span>
                          <span className="shrink-0 tabular-nums">{formatCurrencyBRL(it.amount_cents)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs font-semibold">
                    Total do pedido anterior: {formatCurrencyBRL(originOrder.total_cents)}
                  </p>

                  {originChecklist && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-brand">
                        Ver checklist completa do pedido anterior
                      </summary>
                      <dl className="mt-2 space-y-1.5 rounded-md bg-background/60 p-2">
                        {SERVICE_REPORT_CHECKLIST.map((item) => (
                          <div key={item.key} className="flex items-start justify-between gap-3 text-xs">
                            <dt className="text-muted-foreground">{item.label}</dt>
                            <dd className="shrink-0 font-semibold">
                              {(originChecklist.answers as Record<string, boolean>)[item.key] ? "Sim" : "Não"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {originChecklist.observations && (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-background/60 p-2 text-xs">
                          {originChecklist.observations}
                        </p>
                      )}
                    </details>
                  )}

                  <Link
                    href={`/os/${order.origin_service_order_id}`}
                    className="mt-3 inline-block text-xs font-semibold text-brand underline"
                  >
                    Abrir OS original
                  </Link>
                </div>
              )}
              <ul className="space-y-2">
                {(relatedOrders ?? []).map((related: any) => (
                  <li key={related.id}>
                    <Link
                      href={`/os/${related.id}`}
                      className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-xs hover:bg-muted/40"
                    >
                      <span>{formatServiceOrderCode(related.code_seq)}</span>
                      <ServiceOrderStatusBadge status={related.status as ServiceOrderStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
            <h2 className="mb-3 text-sm font-semibold">Histórico</h2>
            <ol className="space-y-3">
              {(events ?? []).length === 0 && (
                <li className="text-sm text-muted-foreground">Sem movimentações ainda.</li>
              )}
              {(events ?? []).map((event: any) => (
                <li key={event.id} className="border-l-2 border-border/70 pl-3">
                  <p className="text-sm font-medium">
                    {event.from_status
                      ? `${SERVICE_ORDER_STATUS_LABEL[event.from_status as ServiceOrderStatus]} → ${SERVICE_ORDER_STATUS_LABEL[event.to_status as ServiceOrderStatus]}`
                      : SERVICE_ORDER_STATUS_LABEL[event.to_status as ServiceOrderStatus]}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                  {event.reason && <p className="mt-0.5 text-xs text-muted-foreground">{event.reason}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
