"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { queueMutation } from "@/lib/field-service/offline";
import { notify, notifyError } from "@/lib/ui/feedback";
import { syncNow } from "../sync";

type Item = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
  kind: string;
  approved: boolean;
};

/**
 * Venda feita na residencia. Entra como upsell pendente: o valor so conta
 * depois que o ADM aprova na conferencia, e e sobre ele que sai a comissao
 * do tecnico.
 */
export function UpsellPanel({
  serviceOrderId,
  items,
  readOnly,
}: {
  serviceOrderId: string;
  items: Item[];
  readOnly: boolean;
}) {
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const contracted = items.filter((item) => item.kind === "original");
  const upsells = items.filter((item) => item.kind === "upsell");

  async function add() {
    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(price);

    if (!description.trim()) {
      notify({ title: "Descreva o que foi vendido", tone: "error" });
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      notify({ title: "Quantidade inválida", tone: "error" });
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      notify({ title: "Valor inválido", tone: "error" });
      return;
    }

    setSaving(true);
    try {
      await queueMutation({
        kind: "upsell_item",
        serviceOrderId,
        payload: {
          description: description.trim(),
          quantity: parsedQuantity,
          unit_price: parsedPrice,
        },
      });

      if (navigator.onLine) {
        const outcome = await syncNow();
        if (outcome.failed.length > 0) throw new Error(outcome.failed[0].error);
        notify({ title: "Item enviado pra aprovação", tone: "success" });
        router.refresh();
      } else {
        notify({
          title: "Item guardado no celular",
          description: "Sobe sozinho quando a internet voltar.",
          tone: "info",
        });
      }

      setDescription("");
      setQuantity("1");
      setPrice("");
    } catch (error) {
      notifyError(error, "Não foi possível registrar o item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="h-4 w-4 text-brand" /> Serviço
      </h2>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contratado
        </p>
        {contracted.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem itens lançados.</p>
        ) : (
          <ul className="space-y-1">
            {contracted.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {item.quantity}x {item.description}
                </span>
                <span className="shrink-0 font-medium">{formatCurrencyBRL(item.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {upsells.length > 0 && (
        <div className="space-y-1.5 border-t border-border/50 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vendido em campo
          </p>
          <ul className="space-y-1">
            {upsells.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {item.quantity}x {item.description}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={item.approved ? "success" : "warning"}>
                    {item.approved ? "Aprovado" : "Pendente"}
                  </Badge>
                  <span className="font-medium">{formatCurrencyBRL(item.amount_cents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!readOnly && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="upsell_description">Vender a mais</Label>
            <Input
              id="upsell_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: impermeabilização da poltrona"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="upsell_quantity">Qtd</Label>
              <Input
                id="upsell_quantity"
                type="number"
                inputMode="numeric"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upsell_price">Valor (R$)</Label>
              <Input
                id="upsell_price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="199,00"
              />
            </div>
          </div>
          <Button type="button" variant="brand" className="w-full" disabled={saving} onClick={add}>
            <Plus className="h-4 w-4" />
            {saving ? "Salvando..." : "Lançar venda"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            O escritório aprova antes de virar faturamento.
          </p>
        </div>
      )}
    </section>
  );
}
