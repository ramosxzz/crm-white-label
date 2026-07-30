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
  const [name, setName] = useState("");
  const [newRate, setNewRate] = useState("0");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updatePaymentMethodRates(
          rates.map((rate) => ({
            id: rate.id,
            fee_percent: Number(values[rate.id] ?? 0),
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
        await createPaymentMethodRate({ name, fee_percent: Number(newRate) });
        setName("");
        setNewRate("0");
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
        {rates.map((rate) => (
          <div key={rate.id} className="grid grid-cols-[1fr_7rem_auto] items-center gap-3">
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
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        ))}
      </div>
      <Button type="button" variant="brand" className="mt-4" disabled={pending} onClick={save}>
        Salvar taxas
      </Button>

      <form onSubmit={add} className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[1fr_7rem_auto]">
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
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}
