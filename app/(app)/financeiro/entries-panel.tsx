"use client";

import { useRef, useTransition } from "react";
import { Check, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { confirmDialog, notifyError } from "@/lib/ui/feedback";
import type { FinanceEntry } from "@/lib/supabase/database.types";
import { createFinanceEntry, deleteFinanceEntry, setFinanceEntryPaid } from "./actions";

function formatDate(value: string | null) {
  if (!value) return "sem vencimento";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function isOverdue(entry: FinanceEntry, today: string) {
  return entry.status === "aberta" && Boolean(entry.due_date) && entry.due_date! < today;
}

export function EntriesPanel({
  kind,
  entries,
  today,
}: {
  kind: "pagar" | "receber";
  entries: FinanceEntry[];
  today: string;
}) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const open = entries.filter((entry) => entry.status === "aberta");
  const openTotal = open.reduce((sum, entry) => sum + entry.amount_cents, 0);
  const title = kind === "receber" ? "A receber" : "A pagar";

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", kind);
    start(async () => {
      try {
        await createFinanceEntry(fd);
        formRef.current?.reset();
      } catch (error) {
        notifyError(error, "Não foi possível lançar a conta");
      }
    });
  }

  function togglePaid(id: string, paid: boolean) {
    start(async () => {
      try {
        await setFinanceEntryPaid({ id, paid });
      } catch (error) {
        notifyError(error, "Não foi possível atualizar a conta");
      }
    });
  }

  // confirmDialog FORA da transicao: dentro dela o setState que abre o
  // dialogo virava parte da propria transicao, que so terminava quando o
  // usuario clicasse num dialogo que nunca aparecia. Resultado: clicar na
  // lixeira nao fazia absolutamente nada, sem erro nenhum.
  async function remove(entry: FinanceEntry) {
    const confirmed = await confirmDialog({
      title: "Excluir esse lançamento?",
      description: entry.description,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!confirmed) return;
    start(async () => {
      try {
        await deleteFinanceEntry({ id: entry.id });
      } catch (error) {
        notifyError(error, "Não foi possível excluir");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-elev-1">
      <header className="flex items-center justify-between border-b border-border/70 px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span
          className={
            kind === "receber" ? "text-sm font-semibold text-success" : "text-sm font-semibold text-destructive"
          }
        >
          {formatCurrencyBRL(openTotal)}
        </span>
      </header>

      <ul className="divide-y divide-border/70">
        {entries.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhum lançamento nesse mês.
          </li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.description}</p>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>{formatDate(entry.due_date)}</span>
                {entry.category && <span>· {entry.category}</span>}
                {entry.is_recurring && (
                  <span className="inline-flex items-center gap-0.5 text-brand">
                    <Repeat className="h-3 w-3" /> fixa
                  </span>
                )}
              </p>
            </div>

            {entry.status === "paga" ? (
              <Badge variant="success">Paga</Badge>
            ) : isOverdue(entry, today) ? (
              <Badge variant="destructive">Vencida</Badge>
            ) : (
              <Badge variant="outline">Aberta</Badge>
            )}

            <span className="w-28 shrink-0 text-right text-sm font-medium">
              {formatCurrencyBRL(entry.amount_cents)}
            </span>

            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                title={entry.status === "paga" ? "Reabrir" : "Marcar como paga"}
                onClick={() => togglePaid(entry.id, entry.status !== "paga")}
              >
                {entry.status === "paga" ? (
                  <Undo2 className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                title="Excluir"
                onClick={() => remove(entry)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        onSubmit={onAdd}
        className="grid grid-cols-1 gap-3 border-t border-border/70 px-5 py-4 sm:grid-cols-[1fr_8rem_9rem_auto]"
      >
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-description`}>Descrição</Label>
          <Input
            id={`${kind}-description`}
            name="description"
            required
            placeholder={kind === "pagar" ? "Aluguel, produto, combustível" : "Serviço avulso"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-amount`}>Valor (R$)</Label>
          <Input
            id={`${kind}-amount`}
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-due`}>Vencimento</Label>
          <Input id={`${kind}-due`} name="due_date" type="date" required />
        </div>
        <div className="flex items-end gap-3">
          <label className="mb-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <input type="checkbox" name="is_recurring" className="h-3.5 w-3.5" />
            Fixa
          </label>
          <Button type="submit" variant="brand" disabled={pending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}
