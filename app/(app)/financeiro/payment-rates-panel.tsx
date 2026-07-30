"use client";

import { useState, useTransition } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify, notifyError } from "@/lib/ui/feedback";
import type { PaymentMethodRate } from "@/lib/supabase/database.types";
import { createPaymentMethodRate, updatePaymentMethodRates } from "./actions";

export function PaymentRatesPanel({ rates }: { rates: PaymentMethodRate[] }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(rates.map((rate) => [rate.id, String(rate.fee_percent)])),
  );
  const [active, setActive] = useState(() =>
    Object.fromEntries(rates.map((rate) => [rate.id, rate.is_active])),
  );
  const [installments, setInstallments] = useState(() =>
    Object.fromEntries(rates.map((rate) => [rate.id, String(rate.installment_count)])),
  );
  const [minimums, setMinimums] = useState(() =>
    Object.fromEntries(
      rates.map((rate) => [rate.id, (rate.minimum_installment_cents / 100).toFixed(2)]),
    ),
  );
  const [name, setName] = useState("");
  const [newRate, setNewRate] = useState("0");
  const [newInstallments, setNewInstallments] = useState("1");
  const [newMinimum, setNewMinimum] = useState("0");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updatePaymentMethodRates(
          rates.map((rate) => ({
            id: rate.id,
            fee_percent: Number(values[rate.id] ?? 0),
            installment_count: Number(installments[rate.id] ?? 1),
            minimum_installment: Number(minimums[rate.id] ?? 0),
            is_active: Boolean(active[rate.id]),
          })),
        );
        notify({ title: "Taxas salvas", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível salvar as taxas");
      }
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      try {
        await createPaymentMethodRate({
          name,
          fee_percent: Number(newRate),
          installment_count: Number(newInstallments),
          minimum_installment: Number(newMinimum),
        });
        setName("");
        setNewRate("0");
        setNewInstallments("1");
        setNewMinimum("0");
        notify({ title: "Forma de pagamento adicionada", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível adicionar");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
        <CreditCard className="h-4 w-4 text-brand" /> Taxas de pagamento
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        A taxa vira uma conta a pagar da OS. Os percentuais podem ser preenchidos quando a tabela da maquininha chegar.
      </p>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_7rem_6rem_8rem] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Forma</span>
          <span>Taxa (%)</span>
          <span>Parcelas</span>
          <span>Parcela minima</span>
        </div>
        {rates.map((rate) => (
          <div key={rate.id} className="grid grid-cols-[1fr_7rem_6rem_8rem] items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(active[rate.id])}
                onChange={(event) =>
                  setActive((current) => ({ ...current, [rate.id]: event.target.checked }))
                }
              />
              {rate.name}
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={values[rate.id] ?? "0"}
              onChange={(event) =>
                setValues((current) => ({ ...current, [rate.id]: event.target.value }))
              }
            />
            <Input
              type="number"
              min="1"
              max="36"
              step="1"
              value={installments[rate.id] ?? "1"}
              onChange={(event) =>
                setInstallments((current) => ({ ...current, [rate.id]: event.target.value }))
              }
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              value={minimums[rate.id] ?? "0"}
              onChange={(event) =>
                setMinimums((current) => ({ ...current, [rate.id]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <Button type="button" variant="brand" className="mt-4" disabled={pending} onClick={save}>
        Salvar taxas
      </Button>

      <form onSubmit={add} className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[1fr_7rem_6rem_8rem_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="new-method">Nova forma/parcelamento</Label>
          <Input
            id="new-method"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Crédito 3x"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-rate">Taxa (%)</Label>
          <Input
            id="new-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={newRate}
            onChange={(event) => setNewRate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-installments">Parcelas</Label>
          <Input
            id="new-installments"
            type="number"
            min="1"
            max="36"
            step="1"
            value={newInstallments}
            onChange={(event) => setNewInstallments(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-minimum">Minima (R$)</Label>
          <Input
            id="new-minimum"
            type="number"
            min="0"
            step="0.01"
            value={newMinimum}
            onChange={(event) => setNewMinimum(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}
