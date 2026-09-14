"use client";

import Link from "next/link";
import {
  CalendarClock,
  ExternalLink,
  MapPin,
  Phone,
  Store,
  UserRound,
  Wrench,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatOperationalAddress,
  formatOperationalWindow,
  summarizeServiceItems,
} from "@/lib/field-service/os-presentation";
import { formatCurrencyBRL } from "@/lib/utils";
import type { FieldServiceUser } from "@/lib/field-service/users";
import type { AgendaOrder } from "./agenda-grid";

function formatAuditDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function DetailLine({
  icon: Icon,
  children,
}: {
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
      <span>{children}</span>
    </p>
  );
}

export function AgendaOrderPreview({
  order,
  technicians,
  onClose,
}: {
  order: AgendaOrder | null;
  technicians: FieldServiceUser[];
  onClose: () => void;
}) {
  if (!order) return null;
  const technicianNames = technicians
    .filter((technician) => order.technicianIds.includes(technician.id))
    .map((technician) => technician.name);
  const serviceItems = summarizeServiceItems(order.serviceItems, 6);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="border-b border-border/70 pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            OS-{String(order.codeSeq).padStart(4, "0")}
          </p>
          <DialogTitle className="pr-6 text-xl">{order.leadName}</DialogTitle>
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {formatOperationalWindow(
              order.scheduledStartAt,
              order.scheduledEndAt,
            )}
          </p>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-2 rounded-lg border border-border/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Cliente
            </h3>
            {order.leadPhone && (
              <DetailLine icon={Phone}>{order.leadPhone}</DetailLine>
            )}
            <DetailLine icon={MapPin}>
              {formatOperationalAddress({
                street: order.addressStreet,
                number: order.addressNumber,
                district: order.addressDistrict,
                city: order.addressCity,
              })}
            </DetailLine>
          </section>

          <section className="space-y-2 rounded-lg border border-border/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Operação
            </h3>
            <DetailLine icon={Wrench}>
              {technicianNames.join(" + ") || "Sem técnico"}
            </DetailLine>
            <DetailLine icon={UserRound}>
              {[order.consultantName, order.consultantExtraName]
                .filter(Boolean)
                .join(" + ") || "Consultor não informado"}
            </DetailLine>
            <DetailLine icon={Store}>
              {order.partnerName || "Parceiro não informado"}
            </DetailLine>
            <DetailLine icon={CalendarClock}>
              {order.confirmedAt
                ? `Confirmado com ${order.confirmedContactName || order.leadName}`
                : "Aguardando confirmação"}
            </DetailLine>
          </section>
        </div>

        <section className="rounded-lg border border-border/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Serviço e peças
            </h3>
            <span className="font-semibold tabular-nums">
              {formatCurrencyBRL(order.totalCents)}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {serviceItems.length > 0 ? (
              serviceItems.map((item) => <li key={item}>• {item}</li>)
            ) : (
              <li>Nenhum item cadastrado</li>
            )}
          </ul>
          {order.paymentMethod && (
            <p className="mt-2 text-xs font-medium">
              Pagamento: {order.paymentMethod}
            </p>
          )}
        </section>

        {order.observations && (
          <section className="rounded-lg bg-muted/40 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider">
              Observações
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {order.observations}
            </p>
          </section>
        )}

        <section className="grid gap-1 rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground sm:grid-cols-2">
          <p>
            Criada por {order.createdByName || "usuário do sistema"} em{" "}
            {formatAuditDate(order.createdAt)}
          </p>
          <p>Atualizada em {formatAuditDate(order.updatedAt)}</p>
          {order.confirmedAt && (
            <p>
              Confirmada por {order.confirmedByName || "usuário do sistema"}
            </p>
          )}
          {order.reviewedByName && <p>Conferida por {order.reviewedByName}</p>}
        </section>

        <Link
          href={`/os/${order.id}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          <ExternalLink className="h-4 w-4" /> Abrir OS completa
        </Link>
      </DialogContent>
    </Dialog>
  );
}
