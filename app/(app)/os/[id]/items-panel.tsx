"use client";

import { useRef, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { confirmDialog, notifyError } from "@/lib/ui/feedback";
import type { ServiceOrderItem } from "@/lib/supabase/database.types";
import {
  addServiceOrderItem,
  deleteServiceOrderItem,
  setServiceOrderItemApproved,
} from "../actions";

export function ItemsPanel({
  serviceOrderId,
  items,
  canEdit,
  canApprove,
  canDelete,
}: {
  serviceOrderId: string;
  items: ServiceOrderItem[];
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const approvedTotal = items
    .filter((item) => item.approved)
    .reduce((sum, item) => sum + item.amount_cents, 0);
  const pendingTotal = items
    .filter((item) => !item.approved)
    .reduce((sum, item) => sum + item.amount_cents, 0);

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("service_order_id", serviceOrderId);
    start(async () => {
      try {
        await addServiceOrderItem(fd);
        formRef.current?.reset();
      } catch (error) {
        notifyError(error, "Não foi possível adicionar a peça");
      }
    });
  }

  function onToggleApproved(itemId: string, approved: boolean) {
    start(async () => {
      try {
        await setServiceOrderItemApproved({ item_id: itemId, approved });
      } catch (error) {
        notifyError(error, "Não foi possível atualizar o item");
      }
    });
  }

  function onDelete(itemId: string, description: string) {
    start(async () => {
      const confirmed = await confirmDialog({
        title: "Remover peça da OS?",
        description: description,
        confirmLabel: "Remover",
        tone: "danger",
      });
      if (!confirmed) return;
      try {
        await deleteServiceOrderItem({ item_id: itemId });
      } catch (error) {
        notifyError(error, "Não foi possível remover o item");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-elev-1">
      <header className="flex items-center justify-between border-b border-border/70 px-5 py-3">
        <h2 className="text-sm font-semibold">Peças e serviços</h2>
        <div className="text-right text-xs">
          <p className="font-semibold">{formatCurrencyBRL(approvedTotal)}</p>
          {pendingTotal > 0 && (
            <p className="text-muted-foreground">
              + {formatCurrencyBRL(pendingTotal)} aguardando aprovação
            </p>
          )}
        </div>
      </header>

      <ul className="divide-y divide-border/70">
        {items.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhuma peça lançada nessa OS ainda.
          </li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.description}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity}x {formatCurrencyBRL(item.unit_price_cents)}
              </p>
            </div>
            {item.kind === "upsell" && (
              <Badge variant={item.approved ? "success" : "warning"}>
                {item.approved ? "Upsell aprovado" : "Upsell pendente"}
              </Badge>
            )}
            <span className="w-24 text-right text-sm font-medium">
              {formatCurrencyBRL(item.amount_cents)}
            </span>
            <div className="flex items-center gap-1">
              {canApprove && item.kind === "upsell" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onToggleApproved(item.id, !item.approved)}
                  title={item.approved ? "Rejeitar upsell" : "Aprovar upsell"}
                >
                  {item.approved ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => onDelete(item.id, item.description)}
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {canEdit && (
        <form
          ref={formRef}
          onSubmit={onAdd}
          className="grid grid-cols-1 gap-3 border-t border-border/70 px-5 py-4 sm:grid-cols-[1fr_5rem_7rem_9rem_auto]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="description">Peça / serviço</Label>
            <Input id="description" name="description" required placeholder="Poltrona fixa - lavagem" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Qtd</Label>
            <Input id="quantity" name="quantity" type="number" step="1" min="1" defaultValue={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit_price">Valor (R$)</Label>
            <Input id="unit_price" name="unit_price" type="number" step="0.01" min="0" defaultValue={0} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kind">Tipo</Label>
            <select
              id="kind"
              name="kind"
              className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
            >
              <option value="original">Da venda</option>
              <option value="upsell">Vendido em campo</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="brand" disabled={pending}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
