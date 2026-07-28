"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrencyBRL } from "@/lib/utils";
import { addLeadValueItem, deleteLeadValueItem } from "./value-actions";

type ValueItem = {
  id: string;
  label: string;
  amount_cents: number;
  created_at: string;
};

export function ValuePanel({
  leadId,
  items,
  totalCents,
}: {
  leadId: string;
  items: ValueItem[];
  totalCents: number;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!label.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    startTransition(async () => {
      await addLeadValueItem({ leadId, label: label.trim(), amountCents: Math.round(parsedAmount * 100) });
      setLabel("");
      setAmount("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteLeadValueItem({ id, leadId });
    });
  }

  return (
    <div className="space-y-2">
      <span className="font-mono text-base font-semibold">{formatCurrencyBRL(totalCents)}</span>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{item.label}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono">{formatCurrencyBRL(item.amount_cents)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => remove(item.id)}
                disabled={isPending}
                title="Remover item"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Input
          placeholder="Curso, produto..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8 min-w-0 flex-1 text-xs"
        />
        <Input
          placeholder="R$"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 w-20 shrink-0 text-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={submit}
          disabled={isPending || !label.trim() || !amount.trim()}
          title="Adicionar item"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
