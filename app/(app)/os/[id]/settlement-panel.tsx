"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, CircleDollarSign, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrencyBRL } from "@/lib/utils";
import { notify, notifyError } from "@/lib/ui/feedback";
import type {
  FinancialAdjustmentRequest,
  PaymentMethodRate,
  ServiceOrderStatus,
} from "@/lib/supabase/database.types";
import { reviewFinancialAdjustment, saveServiceOrderSettlement } from "../actions";

export function SettlementPanel({
  serviceOrderId,
  status,
  totalCents,
  expectedCents,
  receivedCents,
  paymentMethod,
  rates,
  requests,
  isOwner,
}: {
  serviceOrderId: string;
  status: ServiceOrderStatus;
  totalCents: number;
  expectedCents: number | null;
  receivedCents: number;
  paymentMethod: string | null;
  rates: PaymentMethodRate[];
  requests: FinancialAdjustmentRequest[];
  isOwner: boolean;
}) {
  const [expected, setExpected] = useState(((expectedCents ?? totalCents) / 100).toFixed(2));
  const [received, setReceived] = useState((receivedCents / 100).toFixed(2));
  const [method, setMethod] = useState(paymentMethod ?? "");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const pendingCents = useMemo(
    () =>
      Math.max(
        0,
        Math.round((Number(expected.replace(",", ".")) - Number(received.replace(",", "."))) * 100),
      ),
    [expected, received],
  );
  const locked = status === "faturada";

  function save(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      try {
        const result = await saveServiceOrderSettlement({
          service_order_id: serviceOrderId,
          expected: Number(expected.replace(",", ".")),
          received: Number(received.replace(",", ".")),
          payment_method: method || null,
          reason: reason.trim() || undefined,
        });
        notify({
          title: result.pendingApproval
            ? "Alteração enviada para aprovação de um dono"
            : "Acerto da OS salvo",
          tone: "success",
        });
        if (result.pendingApproval) setReason("");
      } catch (error) {
        notifyError(error, "Não foi possível salvar o acerto");
      }
    });
  }

  function review(requestId: string, approve: boolean) {
    start(async () => {
      try {
        await reviewFinancialAdjustment({ request_id: requestId, approve });
        notify({ title: approve ? "Alteração liberada" : "Alteração recusada", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível revisar a solicitação");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
        <CircleDollarSign className="h-4 w-4 text-brand" /> Acerto final
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Previsto, recebido e pendente desta OS. Taxas são lançadas conforme a forma de pagamento.
      </p>

      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="settlement-expected">Previsto (R$)</Label>
            <Input
              id="settlement-expected"
              type="number"
              min="0"
              step="0.01"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settlement-received">Recebido (R$)</Label>
            <Input
              id="settlement-received"
              type="number"
              min="0"
              step="0.01"
              value={received}
              onChange={(event) => setReceived(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settlement-method">Forma de pagamento</Label>
          <select
            id="settlement-method"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
          >
            <option value="">Não informada</option>
            {rates.filter((rate) => rate.is_active).map((rate) => (
              <option key={rate.id} value={rate.name}>
                {rate.name}{rate.fee_percent > 0 ? ` · taxa ${rate.fee_percent}%` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Pendente</span>
          <strong className={pendingCents > 0 ? "text-sm text-warning" : "text-sm text-success"}>
            {formatCurrencyBRL(pendingCents)}
          </strong>
        </div>
        {locked && (
          <div className="space-y-1.5">
            <Label htmlFor="settlement-reason">Motivo da alteração</Label>
            <Textarea
              id="settlement-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Obrigatório: será enviado para liberação de um dono."
            />
          </div>
        )}
        <Button type="submit" variant="brand" className="w-full" disabled={pending}>
          {locked ? "Solicitar alteração" : "Salvar acerto"}
        </Button>
      </form>

      {requests.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border/70 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de ajustes
          </h3>
          {requests.map((request) => (
            <div key={request.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{request.reason}</p>
                <Badge
                  variant={
                    request.status === "aprovado"
                      ? "success"
                      : request.status === "recusado"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {request.status}
                </Badge>
              </div>
              {request.status === "pendente" && isOwner && (
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="brand"
                    disabled={pending}
                    onClick={() => review(request.id, true)}
                  >
                    <Check className="h-3.5 w-3.5" /> Liberar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => review(request.id, false)}
                  >
                    <X className="h-3.5 w-3.5" /> Recusar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
