"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { previewServiceOrderCommissions, transitionServiceOrder } from "../actions";
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
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewServiceOrderCommissions>> | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, startConfirm] = useTransition();

  // Reconsulta a comissao toda vez que os itens mudam (peca adicionada
  // dentro do proprio modal ja reflete no valor antes de confirmar).
  useEffect(() => {
    if (!open) return;
    setLoadingPreview(true);
    previewServiceOrderCommissions(serviceOrderId)
      .then(setPreview)
      .catch((err) => notifyError(err, "Não foi possível calcular as comissões"))
      .finally(() => setLoadingPreview(false));
  }, [open, serviceOrderId, items]);

  function confirmarFaturamento() {
    startConfirm(async () => {
      try {
        await transitionServiceOrder({ id: serviceOrderId, to: "faturada" });
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
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Faturar OS</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
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

          <section>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Peças / serviço — adicione mais se faltou algo, recalcula sozinho
            </p>
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
          </section>

          <section className="rounded-lg border border-border/70 p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Comissões que vão sair</p>
            {loadingPreview ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Calculando...
              </div>
            ) : !preview || preview.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma comissão será gerada nesta OS.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {preview.map((line, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>
                      {COMMISSION_PARTY_LABEL[line.partyKind]}
                      {line.partnerName ? ` (${line.partnerName})` : ""}
                    </span>
                    <span className="font-semibold">{formatCurrencyBRL(line.amountCents)}</span>
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
          <Button type="button" variant="brand" onClick={confirmarFaturamento} disabled={confirming || loadingPreview}>
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar faturamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
