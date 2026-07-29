import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Phone, Plug, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  canAccessServiceOrders,
  canManageServiceOrders,
  canReviewServiceOrder,
  isTechnician as isTechnicianRole,
} from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
  formatServiceOrderCode,
  isServiceOrderLocked,
} from "@/lib/field-service/status";
import { listTechnicians } from "@/lib/field-service/users";
import type {
  ServiceOrderItem,
  ServiceOrderStatus,
} from "@/lib/supabase/database.types";
import { ServiceOrderStatusBadge } from "../status-badge";
import { ItemsPanel } from "./items-panel";
import { SchedulePanel } from "./schedule-panel";
import { StatusActions } from "./status-actions";
import { ServiceOrdersLive } from "../service-orders-live";

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

  const [{ data: items }, { data: assigned }, { data: damages }, { data: events }] = await Promise.all([
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
  ]);

  const canManage = canManageServiceOrders(ctx.role);
  const canReview = canReviewServiceOrder(ctx.role);
  const isTech = isTechnicianRole(ctx.role);
  const technicians = canManage ? await listTechnicians(ctx.tenantId) : [];

  const assignedIds = (assigned ?? []).map((row: any) => row.user_id as string);
  const technicianNames = technicians
    .filter((tech) => assignedIds.includes(tech.id))
    .map((tech) => tech.name);

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
            <StatusActions
              serviceOrderId={order.id}
              status={status}
              canManage={canManage}
              canReview={canReview}
              isTechnician={isTech}
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
            canEdit={!locked && (canManage || isTech)}
            canApprove={canReview}
            canDelete={canManage && !locked}
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
        </div>

        <div className="space-y-6">
          {canManage && !locked && (
            <SchedulePanel
              serviceOrderId={order.id}
              technicians={technicians}
              currentDate={order.service_date}
              currentShift={order.shift}
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
