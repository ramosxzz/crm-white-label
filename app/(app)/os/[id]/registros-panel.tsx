import { FileText, History, RotateCcw } from "lucide-react";
import Link from "next/link";
import { formatCurrencyBRL } from "@/lib/utils";
import { SERVICE_REPORT_CHECKLIST } from "@/lib/field-service/checklist";
import { SERVICE_ORDER_STATUS_LABEL, formatServiceOrderCode } from "@/lib/field-service/status";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import type { FieldServiceUser } from "@/lib/field-service/users";
import { FollowupsPanel, type FollowupRow } from "./followups-panel";

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

type EventRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  reason: string | null;
};

type Checklist = { answers: unknown; observations: string | null } | null;

type OriginOrder = { id: string; code_seq: number; service_date: string | null; total_cents: number } | null;

/**
 * "REGISTROS E APONTAMENTOS" do sistema legado: um log unico com tudo que
 * aconteceu na OS, em vez de espalhado em 3-4 cards separados. Historico de
 * status, laudo tecnico e o resumo do pedido anterior (reaplicacao) entram
 * como entradas somente-leitura; os proximos contatos (FollowupsPanel) ficam
 * dentro da mesma secao mas continuam com form/acoes proprias, por isso nao
 * viram uma entrada estatica do log.
 */
export function RegistrosPanel({
  serviceOrderId,
  events,
  checklist,
  originOrder,
  originItems,
  originChecklist,
  originServiceOrderId,
  followups,
  consultants,
  canManageFollowups,
}: {
  serviceOrderId: string;
  events: EventRow[];
  checklist: Checklist;
  originOrder: OriginOrder;
  originItems: { description: string; quantity: number; amount_cents: number }[] | null;
  originChecklist: Checklist;
  originServiceOrderId: string | null;
  followups: FollowupRow[];
  consultants: FieldServiceUser[];
  canManageFollowups: boolean;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-elev-1">
      <header className="border-b border-border/70 px-5 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-brand" /> Registros e apontamentos
        </h2>
      </header>

      <div className="space-y-4 p-5">
        {originOrder && (
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <RotateCcw className="h-3.5 w-3.5" />
              Cliente retornando — resumo do último pedido ({formatServiceOrderCode(originOrder.code_seq)}
              {originOrder.service_date ? `, ${formatDate(originOrder.service_date)}` : ""})
            </p>
            {(originItems ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {(originItems ?? []).map((it, i) => (
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
                  Ver laudo do pedido anterior
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
              href={`/os/${originServiceOrderId}`}
              className="mt-3 inline-block text-xs font-semibold text-brand underline"
            >
              Abrir OS original
            </Link>
          </div>
        )}

        {checklist && (
          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Laudo técnico
            </p>
            <dl className="space-y-1.5">
              {SERVICE_REPORT_CHECKLIST.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-3 text-xs">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="shrink-0 font-semibold">
                    {(checklist.answers as Record<string, boolean>)[item.key] ? "Sim" : "Não"}
                  </dd>
                </div>
              ))}
            </dl>
            {checklist.observations && (
              <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                {checklist.observations}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de status
          </p>
          <ol className="space-y-2.5">
            {events.length === 0 && (
              <li className="text-sm text-muted-foreground">Sem movimentações ainda.</li>
            )}
            {events.map((event) => (
              <li key={event.id} className="border-l-2 border-border/70 pl-3 text-sm">
                <p className="font-medium">
                  {event.from_status
                    ? `${SERVICE_ORDER_STATUS_LABEL[event.from_status as ServiceOrderStatus]} → ${SERVICE_ORDER_STATUS_LABEL[event.to_status as ServiceOrderStatus]}`
                    : SERVICE_ORDER_STATUS_LABEL[event.to_status as ServiceOrderStatus]}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                {event.reason && <p className="mt-0.5 text-xs text-muted-foreground">{event.reason}</p>}
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-border/70 pt-4">
          <FollowupsPanel
            serviceOrderId={serviceOrderId}
            followups={followups}
            consultants={consultants}
            canManage={canManageFollowups}
            embedded
          />
        </div>
      </div>
    </section>
  );
}
