"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Ban, CalendarClock, CheckCircle2, ExternalLink, Plus, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify, notifyError } from "@/lib/ui/feedback";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AGENDA_END_HOUR,
  AGENDA_MIN_CARD_MINUTES,
  AGENDA_PX_PER_MINUTE,
  AGENDA_START_HOUR,
  AGENDA_TONE_CLASSES,
  AGENDA_TONE_LABEL,
  agendaCardTone,
  agendaGridHeightPx,
  fallbackWindowForShift,
  formatHourMinute,
  minutesFromGridStart,
} from "@/lib/field-service/agenda";
import type { FieldServicePartner, ServiceOrderStatus } from "@/lib/supabase/database.types";
import type { FieldServiceUser } from "@/lib/field-service/users";
import { confirmServiceOrder, setServiceOrderPendingIssue, transitionServiceOrder, unconfirmServiceOrder } from "../actions";
import { NewServiceOrderDialog } from "../new-service-order-dialog";
import { OrderQuickView } from "../mapa/order-quick-view";

export type AgendaOrder = {
  id: string;
  codeSeq: number;
  status: ServiceOrderStatus;
  leadName: string;
  leadPhone: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  serviceLabel: string | null;
  totalCents: number;
  shift: "manha" | "tarde" | null;
  serviceDate: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  confirmedAt: string | null;
  hasPendingIssue: boolean;
  technicianIds: string[];
};

function cityLine(order: AgendaOrder) {
  return [order.addressCity, order.addressDistrict].filter(Boolean).join(" · ") || "Endereço não informado";
}

function AgendaCard({
  order,
  day,
  canManage,
  technicians,
  onOpen,
  onAction,
}: {
  order: AgendaOrder;
  day: string;
  canManage: boolean;
  technicians: FieldServiceUser[];
  onOpen: (id: string) => void;
  onAction: (fn: () => Promise<void>, successMsg?: string) => void;
}) {
  const window_ = order.scheduledStartAt && order.scheduledEndAt
    ? { startAt: order.scheduledStartAt, endAt: order.scheduledEndAt }
    : fallbackWindowForShift(order.serviceDate ?? day, order.shift);
  const tone = agendaCardTone(order);
  const toneClasses = AGENDA_TONE_CLASSES[tone];
  const closed = ["faturada", "cancelada"].includes(order.status);

  const card = (
    <div
      className={cn(
        "block cursor-pointer rounded-md border px-2 py-1.5 text-[11px] leading-tight shadow-sm transition-opacity hover:opacity-90",
        toneClasses.border,
        toneClasses.bg,
        !order.scheduledStartAt && "border-dashed",
      )}
      onClick={() => onOpen(order.id)}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn("truncate font-semibold uppercase tracking-wide", toneClasses.text)}>
          {cityLine(order)}
        </span>
        {order.hasPendingIssue && <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />}
      </div>
      <p className="truncate font-medium">{order.leadName}</p>
      {order.serviceLabel && <p className="truncate text-muted-foreground">{order.serviceLabel}</p>}
      {window_ && (
        <p className="tabular-nums text-muted-foreground">
          {formatHourMinute(window_.startAt)} → {formatHourMinute(window_.endAt)}
          {!order.scheduledStartAt && " (sem horário exato)"}
        </p>
      )}
    </div>
  );

  if (!canManage) return card;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>
          OS-{String(order.codeSeq).padStart(4, "0")} · {order.leadName}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem asChild>
          <Link href={`/os/${order.id}`} className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir OS completa
          </Link>
        </ContextMenuItem>
        {!closed && (
          <ContextMenuItem
            onSelect={() =>
              onAction(async () => {
                if (order.confirmedAt) await unconfirmServiceOrder({ id: order.id });
                else await confirmServiceOrder({ id: order.id });
              })
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {order.confirmedAt ? "Desmarcar confirmação" : "Confirmar com o cliente"}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onSelect={() =>
            onAction(async () => {
              const note = order.hasPendingIssue
                ? undefined
                : window.prompt("Qual o problema/pendência?") ?? undefined;
              if (!order.hasPendingIssue && !note) return;
              await setServiceOrderPendingIssue({
                id: order.id,
                has_pending_issue: !order.hasPendingIssue,
                note,
              });
            })
          }
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {order.hasPendingIssue ? "Remover pendência" : "Marcar pendência"}
        </ContextMenuItem>
        {!closed && technicians.length > 1 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <UserCog className="h-3.5 w-3.5" /> Trocar técnico
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {technicians
                .filter((t) => !order.technicianIds.includes(t.id))
                .map((t) => (
                  <ContextMenuItem
                    key={t.id}
                    onSelect={() =>
                      onAction(async () => {
                        const { scheduleServiceOrder } = await import("../actions");
                        await scheduleServiceOrder({
                          id: order.id,
                          service_date: order.serviceDate ?? day,
                          shift: order.shift ?? "manha",
                          technician_ids: [t.id],
                          scheduled_start_at: order.scheduledStartAt ?? undefined,
                          scheduled_end_at: order.scheduledEndAt ?? undefined,
                          reason: `Trocado pra ${t.name} pela agenda`,
                        });
                      }, `Técnico trocado para ${t.name}`)
                    }
                  >
                    {t.name}
                  </ContextMenuItem>
                ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {!closed && order.status !== "remarcada" && (
          <ContextMenuItem
            onSelect={() =>
              onAction(async () => {
                const reason = window.prompt("Motivo da remarcação:");
                if (!reason) return;
                await transitionServiceOrder({ id: order.id, to: "remarcada", reason });
              }, "Movida para Remarcar")
            }
          >
            <CalendarClock className="h-3.5 w-3.5" /> Mover para Remarcar
          </ContextMenuItem>
        )}
        {!closed && order.status !== "cancelada" && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() =>
                onAction(async () => {
                  const reason = window.prompt("Motivo do cancelamento:");
                  if (!reason) return;
                  await transitionServiceOrder({ id: order.id, to: "cancelada", reason });
                }, "OS cancelada")
              }
            >
              <Ban className="h-3.5 w-3.5" /> Cancelar OS
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function TechnicianColumn({
  day,
  technician,
  orders,
  canManage,
  canCreate = false,
  technicians,
  onOpen,
  onAction,
  onNewHere,
}: {
  day: string;
  technician: FieldServiceUser;
  orders: AgendaOrder[];
  canManage: boolean;
  canCreate?: boolean;
  technicians: FieldServiceUser[];
  onOpen: (id: string) => void;
  onAction: (fn: () => Promise<void>, successMsg?: string) => void;
  onNewHere: (technicianId: string, technicianName: string) => void;
}) {
  const height = agendaGridHeightPx();

  const column = (
    <div className="relative border-r border-border/60" style={{ height }}>
      {Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-x-0 border-t border-slate-300 dark:border-border/30"
          style={{ top: i * 60 * AGENDA_PX_PER_MINUTE }}
        />
      ))}
      {orders.map((order) => {
        const win = order.scheduledStartAt && order.scheduledEndAt
          ? { startAt: order.scheduledStartAt, endAt: order.scheduledEndAt }
          : fallbackWindowForShift(order.serviceDate ?? day, order.shift);
        if (!win) return null;
        const top = Math.max(0, minutesFromGridStart(win.startAt, day) * AGENDA_PX_PER_MINUTE);
        const durationMin = Math.max(
          AGENDA_MIN_CARD_MINUTES,
          (new Date(win.endAt).getTime() - new Date(win.startAt).getTime()) / 60000,
        );
        return (
          <div
            key={order.id}
            className="absolute inset-x-0.5"
            style={{ top, height: durationMin * AGENDA_PX_PER_MINUTE }}
          >
            <AgendaCard order={order} day={day} canManage={canManage} technicians={technicians} onOpen={onOpen} onAction={onAction} />
          </div>
        );
      })}
    </div>
  );

  if (!canManage && !canCreate) return column;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{column}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onNewHere(technician.id, technician.name)}>
          <Plus className="h-3.5 w-3.5" /> Nova OS com {technician.name}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function AgendaGrid({
  day,
  technicians,
  orders,
  canManage,
  canCreate = false,
  leads,
  consultants,
  partners,
}: {
  day: string;
  technicians: FieldServiceUser[];
  orders: AgendaOrder[];
  canManage: boolean;
  /** Vendedora: abre OS nova no horario livre, mas nao gerencia a agenda. */
  canCreate?: boolean;
  leads: Array<{ id: string; name: string; phone: string | null }>;
  consultants: FieldServiceUser[];
  partners: FieldServicePartner[];
}) {
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [newOsPreset, setNewOsPreset] = useState<{ technicianId: string; technicianName: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) => o.leadName.toLowerCase().includes(q) || (o.leadPhone ?? "").includes(q),
    );
  }, [orders, search]);

  const dayOrders = filtered.filter((o) => o.serviceDate === day);
  const remarcarPool = filtered.filter((o) => o.serviceDate === null);

  function onAction(fn: () => Promise<void>, successMsg?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (successMsg) notify({ title: successMsg, tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível concluir a ação");
      }
    });
  }

  const hourLabels = Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR + 1 }, (_, i) => AGENDA_START_HOUR + i);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
      <input
        type="search"
        placeholder="Buscar cliente por nome ou telefone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full max-w-sm rounded-md border border-border/70 bg-background px-3 text-sm"
      />

      {technicians.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
          <p className="font-medium">Nenhum técnico cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre usuários com o papel &quot;Técnico&quot; em Configurações → Usuários pra montar a agenda.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/70 bg-card shadow-elev-1">
          <div
            className="grid min-w-full"
            style={{ gridTemplateColumns: `56px repeat(${technicians.length}, minmax(190px, 1fr)) 190px` }}
          >
            <div className="sticky top-0 z-20 border-b border-r border-border/60 bg-card" />
            {technicians.map((t) => (
              <div key={t.id} className="sticky top-0 z-20 truncate border-b border-r border-border/60 bg-card px-2 py-2 text-center text-sm font-semibold">
                {t.name}
              </div>
            ))}
            <div className="sticky top-0 z-20 border-b border-border/60 bg-card px-2 py-2 text-center text-sm font-semibold text-warning">
              Remarcar ({remarcarPool.length})
            </div>

            <div className="relative" style={{ height: agendaGridHeightPx() }}>
              {hourLabels.map((h) => (
                <div
                  key={h}
                  className={cn(
                    "absolute right-1 text-[10px] leading-none text-muted-foreground",
                    h !== AGENDA_START_HOUR && h !== AGENDA_END_HOUR && "-translate-y-1/2",
                  )}
                  style={{
                    top: h === AGENDA_START_HOUR
                      ? 4
                      : h === AGENDA_END_HOUR
                        ? agendaGridHeightPx() - 14
                        : (h - AGENDA_START_HOUR) * 60 * AGENDA_PX_PER_MINUTE,
                  }}
                >
                  {String(h).padStart(2, "0")}h
                </div>
              ))}
            </div>

            {technicians.map((t) => (
              <TechnicianColumn
                key={t.id}
                day={day}
                technician={t}
                orders={dayOrders.filter((o) => o.technicianIds.includes(t.id))}
                canManage={canManage}
                canCreate={canCreate}
                technicians={technicians}
                onOpen={setQuickViewId}
                onAction={onAction}
                onNewHere={(id, name) => setNewOsPreset({ technicianId: id, technicianName: name })}
              />
            ))}

            <div className="space-y-1.5 border-l border-border/60 p-1.5">
              {remarcarPool.length === 0 ? (
                <p className="p-3 text-center text-[11px] text-muted-foreground">Nada aguardando remarcação.</p>
              ) : (
                remarcarPool.map((order) => (
                  <AgendaCard
                    key={order.id}
                    order={order}
                    day={day}
                    canManage={canManage}
                    technicians={technicians}
                    onOpen={setQuickViewId}
                    onAction={onAction}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {(["amarelo", "azul", "roxo", "verde", "laranja", "vermelho", "cinza"] as const).map((tone) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", AGENDA_TONE_CLASSES[tone].bg, AGENDA_TONE_CLASSES[tone].border, "border")} />
            {AGENDA_TONE_LABEL[tone]}
          </span>
        ))}
      </div>

      <OrderQuickView orderId={quickViewId} onClose={() => setQuickViewId(null)} />

      {newOsPreset && (canManage || canCreate) && (
        <NewServiceOrderDialog
          leads={leads}
          consultants={consultants}
          partners={partners}
          open={Boolean(newOsPreset)}
          onOpenChange={(open) => !open && setNewOsPreset(null)}
          agendaPreset={{
            technicianId: newOsPreset.technicianId,
            technicianName: newOsPreset.technicianName,
            date: day,
            dateLabel: new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR"),
          }}
        />
      )}
    </div>
  );
}
