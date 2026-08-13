"use client";

import { useState, useTransition } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrencyBRL } from "@/lib/utils";
import { notifyError } from "@/lib/ui/feedback";
import { COMMISSION_PARTY_LABEL } from "@/lib/field-service/commissions";
import type { CommissionParty } from "@/lib/supabase/database.types";
import { requestCommissionAdjustment } from "../actions";

export type CommissionRow = {
  id: string;
  partyKind: CommissionParty;
  partnerName: string | null;
  amountCents: number;
  status: "prevista" | "aprovada" | "paga";
  hasPendingRequest: boolean;
};

export function CommissionsPanel({
  serviceOrderId,
  commissions,
  canAdjust,
}: {
  serviceOrderId: string;
  commissions: CommissionRow[];
  canAdjust: boolean;
}) {
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  function openEdit(row: CommissionRow) {
    setEditingId(row.id);
    setAmount((row.amountCents / 100).toFixed(2));
  }

  function submit(row: CommissionRow) {
    const reason = window.prompt("Motivo do ajuste de comissão:");
    if (!reason) return;
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    start(async () => {
      try {
        await requestCommissionAdjustment({
          commission_id: row.id,
          service_order_id: serviceOrderId,
          new_amount_cents: cents,
          reason,
        });
        setEditingId(null);
      } catch (error) {
        notifyError(error, "Não foi possível pedir o ajuste");
      }
    });
  }

  if (commissions.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <h2 className="mb-3 text-sm font-semibold">Comissões</h2>
      <ul className="space-y-2">
        {commissions.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {COMMISSION_PARTY_LABEL[row.partyKind]}
                {row.partnerName ? ` (${row.partnerName})` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.status === "paga" ? "Paga" : row.status === "aprovada" ? "Aprovada" : "Prevista"}
                {row.hasPendingRequest ? " · ajuste pendente de aprovação" : ""}
              </p>
            </div>
            {editingId === row.id ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-8 w-24"
                  inputMode="decimal"
                />
                <Button type="button" size="sm" disabled={pending} onClick={() => submit(row)}>
                  Pedir
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums">{formatCurrencyBRL(row.amountCents)}</span>
                {canAdjust && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(row)}>
                    <PencilLine className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {canAdjust && (
        <p className="mt-3 text-xs text-muted-foreground">
          Ajuste vira um pedido — só um dos donos aprova, com o motivo registrado.
        </p>
      )}
    </section>
  );
}
