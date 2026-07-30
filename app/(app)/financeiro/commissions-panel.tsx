"use client";

import { useTransition } from "react";
import { Check, Pencil, Percent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { notify, notifyError } from "@/lib/ui/feedback";
import { COMMISSION_PARTY_LABEL } from "@/lib/field-service/commissions";
import type { CommissionParty, CommissionStatus } from "@/lib/supabase/database.types";
import {
  requestCommissionAdjustment,
  setCommissionStatus,
  updateCommissionRules,
} from "./actions";
import { reviewFinancialAdjustment } from "../os/actions";

export type CommissionRow = {
  id: string;
  party_kind: CommissionParty;
  who: string;
  base_cents: number;
  percent: number;
  amount_cents: number;
  status: CommissionStatus;
  order_code: number | null;
  adjustment_request_id: string | null;
};

const STATUS_VARIANT: Record<CommissionStatus, "outline" | "info" | "success"> = {
  prevista: "outline",
  aprovada: "info",
  paga: "success",
};

export function CommissionsPanel({
  commissions,
  rules,
  isOwner,
}: {
  commissions: CommissionRow[];
  rules: Record<CommissionParty, number>;
  isOwner: boolean;
}) {
  const [pending, start] = useTransition();

  const pendingTotal = commissions
    .filter((row) => row.status !== "paga")
    .reduce((sum, row) => sum + row.amount_cents, 0);

  // Agrupa por pessoa: no fechamento do mes o que importa e quanto cada um
  // tem a receber, nao a comissao OS por OS.
  const byPerson = new Map<string, { who: string; total: number; rows: CommissionRow[] }>();
  for (const row of commissions) {
    const entry = byPerson.get(row.who) ?? { who: row.who, total: 0, rows: [] };
    entry.total += row.amount_cents;
    entry.rows.push(row);
    byPerson.set(row.who, entry);
  }
  const people = [...byPerson.values()].sort((a, b) => b.total - a.total);

  function markPaid(id: string) {
    start(async () => {
      try {
        await setCommissionStatus({ id, status: "paga" });
      } catch (error) {
        notifyError(error, "Não foi possível atualizar a comissão");
      }
    });
  }

  function adjust(row: CommissionRow) {
    const raw = window.prompt(
      `Novo valor da comissão de ${row.who} (R$):`,
      (row.amount_cents / 100).toFixed(2),
    );
    if (raw == null) return;
    const amount = Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      notify({ title: "Informe um valor válido", tone: "error" });
      return;
    }
    const reason = window.prompt("Motivo do ajuste:")?.trim();
    if (!reason) return;
    start(async () => {
      try {
        await requestCommissionAdjustment({ id: row.id, amount, reason });
        notify({ title: "Ajuste enviado para liberação de um dono", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível solicitar o ajuste");
      }
    });
  }

  function review(requestId: string, approve: boolean) {
    start(async () => {
      try {
        await reviewFinancialAdjustment({ request_id: requestId, approve });
        notify({ title: approve ? "Ajuste liberado" : "Ajuste recusado", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível revisar o ajuste");
      }
    });
  }

  function saveRules(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateCommissionRules(fd);
        notify({ title: "Percentuais salvos", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível salvar os percentuais");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border/70 bg-card shadow-elev-1">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <h2 className="text-sm font-semibold">Comissões do mês</h2>
          <span className="text-sm font-semibold">{formatCurrencyBRL(pendingTotal)} a pagar</span>
        </header>

        {people.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma comissão gerada nesse mês. Elas nascem quando a OS é faturada.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {people.map((person) => (
              <li key={person.who} className="px-5 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{person.who}</p>
                  <span className="shrink-0 text-sm font-semibold">
                    {formatCurrencyBRL(person.total)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {person.rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {COMMISSION_PARTY_LABEL[row.party_kind]}
                        {row.order_code != null && ` · OS-${String(row.order_code).padStart(4, "0")}`}
                      </span>
                      <span className="text-muted-foreground">
                        {row.percent}% de {formatCurrencyBRL(row.base_cents)}
                      </span>
                      <span className="ml-auto font-medium">
                        {formatCurrencyBRL(row.amount_cents)}
                      </span>
                      <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                      {row.adjustment_request_id ? (
                        isOwner ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="brand"
                              disabled={pending}
                              title="Liberar ajuste"
                              onClick={() => review(row.adjustment_request_id!, true)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              title="Recusar ajuste"
                              onClick={() => review(row.adjustment_request_id!, false)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="warning">ajuste pendente</Badge>
                        )
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          title="Ajustar comissão"
                          onClick={() => adjust(row)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {row.status !== "paga" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          title="Marcar como paga"
                          onClick={() => markPaid(row.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
        <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
          <Percent className="h-4 w-4 text-brand" /> Percentuais de comissão
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Valem para as próximas OS faturadas. Comissões já geradas não mudam.
        </p>

        <form onSubmit={saveRules} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="tecnico">Técnico (sobre o vendido em campo)</Label>
            <Input
              id="tecnico"
              name="tecnico"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={rules.tecnico}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendedora_interna">Vendedora interna (sobre o total)</Label>
            <Input
              id="vendedora_interna"
              name="vendedora_interna"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={rules.vendedora_interna}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loja_parceira">Loja parceira (indicação)</Label>
            <Input
              id="loja_parceira"
              name="loja_parceira"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={rules.loja_parceira}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="brand" disabled={pending}>
              Salvar
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
