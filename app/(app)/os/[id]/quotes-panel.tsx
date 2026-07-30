"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilePlus2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrencyBRL } from "@/lib/utils";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import type { ServiceOrderQuote } from "@/lib/supabase/database.types";
import { cancelServiceOrderQuote, convertServiceOrderQuote } from "../actions";

export function QuotesPanel({
  quotes,
  canManage,
}: {
  quotes: ServiceOrderQuote[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const router = useRouter();

  function convert(quote: ServiceOrderQuote) {
    const raw = amounts[quote.id];
    const amount = raw?.trim() ? Number(raw.replace(",", ".")) : null;
    start(async () => {
      try {
        const newId = await convertServiceOrderQuote({ quote_id: quote.id, amount });
        notify({ title: "Nova OS criada a partir do orçamento", tone: "success" });
        router.push(`/os/${newId}`);
      } catch (error) {
        notifyError(error, "Não foi possível criar a nova OS");
      }
    });
  }

  async function cancel(quote: ServiceOrderQuote) {
    const confirmed = await confirmDialog({
      title: "Cancelar este orçamento?",
      description: quote.description,
      confirmLabel: "Cancelar orçamento",
      tone: "danger",
    });
    if (!confirmed) return;
    start(async () => {
      try {
        await cancelServiceOrderQuote({ quote_id: quote.id });
        notify({ title: "Orçamento cancelado", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível cancelar o orçamento");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
        <FilePlus2 className="h-4 w-4 text-brand" /> Orçamentos do atendimento
      </h2>
      <div className="space-y-3">
        {quotes.map((quote) => (
          <div key={quote.id} className="rounded-lg border border-border/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="whitespace-pre-wrap text-sm">{quote.description}</p>
              <Badge
                variant={
                  quote.status === "convertido"
                    ? "success"
                    : quote.status === "cancelado"
                      ? "destructive"
                      : "warning"
                }
              >
                {quote.status}
              </Badge>
            </div>
            {quote.amount_cents != null && quote.status !== "pendente" && (
              <p className="mt-2 text-xs font-medium">{formatCurrencyBRL(quote.amount_cents)}</p>
            )}
            {quote.converted_service_order_id && (
              <Link
                href={`/os/${quote.converted_service_order_id}`}
                className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
              >
                Abrir nova OS
              </Link>
            )}
            {canManage && quote.status === "pendente" && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-36 flex-1 text-xs font-medium text-muted-foreground">
                  Valor previsto (R$)
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amounts[quote.id] ?? ""}
                    onChange={(event) =>
                      setAmounts((current) => ({ ...current, [quote.id]: event.target.value }))
                    }
                    placeholder="Pode ficar em branco"
                  />
                </label>
                <Button type="button" variant="brand" disabled={pending} onClick={() => convert(quote)}>
                  <FilePlus2 className="h-4 w-4" /> Criar nova OS
                </Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => cancel(quote)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
