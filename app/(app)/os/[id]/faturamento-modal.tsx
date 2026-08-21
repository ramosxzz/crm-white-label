"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrencyBRL } from "@/lib/utils";
import { notify, notifyError } from "@/lib/ui/feedback";
import { SERVICE_REPORT_CHECKLIST } from "@/lib/field-service/checklist";
import { COMMISSION_PARTY_LABEL } from "@/lib/field-service/commissions";
import type {
  ServiceCatalogItem,
  ServiceOrderItem,
} from "@/lib/supabase/database.types";
import {
  billServiceOrderWithOverrides,
  previewServiceOrderCommissions,
  type CommissionPreviewLine,
} from "../actions";
import { ItemsPanel } from "./items-panel";

type Checklist = { answers: unknown; observations: string | null } | null;

export function FaturamentoModal({
  serviceOrderId,
  leadName,
  leadPhone,
  leadEmail,
  checklist,
  items,
  catalogItems,
  travelFeeCents,
  canEditItems,
  canApprove,
  canApproveDiscount,
  canDelete,
}: {
  serviceOrderId: string;
  leadName: string;
  leadPhone: string | null;
  leadEmail: string | null;
  checklist: Checklist;
  items: ServiceOrderItem[];
  catalogItems: ServiceCatalogItem[];
  travelFeeCents: number;
  canEditItems: boolean;
  canApprove: boolean;
  canApproveDiscount: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CommissionPreviewLine[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, startConfirm] = useTransition();

  // Reconsulta a comissao toda vez que os itens mudam (peca adicionada
  // dentro do proprio modal ja reflete no valor antes de confirmar) - so
  // reseta o que o admin editou se os itens realmente mudaram, senao
  // perderia o ajuste manual toda hora que o preview roda de novo.
  useEffect(() => {
    if (!open) return;
    setLoadingPreview(true);
    previewServiceOrderCommissions(serviceOrderId)
      .then(setLines)
      .catch((err) => notifyError(err, "Não foi possível calcular as comissões"))
      .finally(() => setLoadingPreview(false));
  }, [open, serviceOrderId, items]);

  function editAmount(index: number, reais: string) {
    const cents = Math.round(Number(reais.replace(",", ".")) * 100);
    setLines((prev) =>
      prev ? prev.map((l, i) => (i === index ? { ...l, amountCents: Number.isFinite(cents) ? Math.max(0, cents) : 0 } : l)) : prev,
    );
  }

  function confirmarFaturamento() {
    if (!lines) return;
    startConfirm(async () => {
      try {
        await billServiceOrderWithOverrides({ serviceOrderId, lines });
        notify({ title: "OS faturada", tone: "success" });
        setOpen(false);
      } catch (err) {
        notifyError(err, "Não foi possível faturar a OS");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="brand">
          Faturar
        </Button>
      </DialogTrigger>
      <DialogContent className="grid max-h-[92vh] w-[97vw] max-w-6xl grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Faturar OS</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-5 overflow-y-auto overflow-x-hidden">
          <section className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
            <p className="font-medium">{leadName}</p>
            <p className="text-xs text-muted-foreground">
              {leadPhone || "sem telefone"}
              {leadEmail ? ` · ${leadEmail}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pra editar nome/telefone/email, use a ficha do lead.
            </p>
          </section>

          {checklist && (
            <section className="rounded-lg border border-border/70 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Laudo técnico</p>
              <dl className="space-y-1.5">
                {SERVICE_REPORT_CHECKLIST.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="shrink-0 font-semibold">
                      {(checklist.answers as Record<string, boolean>)[item.key] ? "Sim" : "Não"}
                    </dd>
                  </div>
                ))}
              </dl>
              {checklist.observations && (
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">
                  {checklist.observations}
                </p>
              )}
            </section>
          )}

          <section className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Peças / serviço — adicione mais se faltou algo, recalcula sozinho
            </p>
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <ItemsPanel
                serviceOrderId={serviceOrderId}
                items={items}
                canEdit={canEditItems}
                canApprove={canApprove}
                canApproveDiscount={canApproveDiscount}
                canDelete={canDelete}
                travelFeeCents={travelFeeCents}
                catalogItems={catalogItems}
              />
            </div>
          </section>

          <section className="rounded-lg border border-border/70 p-3">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              Comissões — confira e altere se precisar antes de faturar
            </p>
            {loadingPreview ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculando...
              </div>
            ) : !lines || lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma comissão será gerada nesta OS.</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((line, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {COMMISSION_PARTY_LABEL[line.partyKind]}
                        {line.partnerName ? ` — ${line.partnerName}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {line.percent}% de {formatCurrencyBRL(line.baseCents)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Label htmlFor={`commission-${i}`} className="sr-only">
                        Valor
                      </Label>
                      <span className="text-xs text-muted-foreground">R$</span>
                      <Input
                        id={`commission-${i}`}
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-28"
                        defaultValue={(line.amountCents / 100).toFixed(2)}
                        onChange={(e) => editAmount(i, e.target.value)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={confirming}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={confirmarFaturamento} disabled={confirming || loadingPreview || !lines}>
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar faturamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
