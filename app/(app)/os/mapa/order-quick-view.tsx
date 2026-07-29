"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MapPin, PenLine, Phone, Store, Wrench, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyBRL } from "@/lib/utils";
import {
  SERVICE_ORDER_SHIFT_LABEL,
  SERVICE_ORDER_STATUS_LABEL,
} from "@/lib/field-service/status";
import { getServiceOrderQuickView, type ServiceOrderQuickView } from "./quick-view-actions";

function formatDate(value: string | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function Linha({
  Icon,
  children,
}: {
  Icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * Detalhe da OS por cima do mapa.
 *
 * Abrir a pagina da OS tirava o ADM do mapa e obrigava a voltar e reencontrar
 * a parada. Aqui ele confere e fecha. E so leitura: quem precisa agendar,
 * conferir ou faturar continua indo pra pagina, pelo atalho no rodape.
 */
export function OrderQuickView({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<ServiceOrderQuickView | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let ativo = true;
    setData(null);
    setErro(null);
    getServiceOrderQuickView(orderId)
      .then((res) => ativo && setData(res))
      .catch((e) => ativo && setErro((e as Error).message));
    return () => {
      ativo = false;
    };
  }, [orderId]);

  const upsell = (data?.items ?? []).filter((i) => i.kind === "upsell");
  const originais = (data?.items ?? []).filter((i) => i.kind === "original");

  return (
    <Dialog open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {!data && !erro && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando ordem de serviço...
          </div>
        )}

        {erro && (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">Não foi possível abrir a OS</p>
            <p className="mt-1 text-xs text-muted-foreground">{erro}</p>
          </div>
        )}

        {data && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-lg leading-tight">{data.leadName}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {data.code}
                {data.serviceDate ? ` · ${formatDate(data.serviceDate)}` : ""}
                {data.shift ? ` · ${SERVICE_ORDER_SHIFT_LABEL[data.shift]}` : ""}
                {data.routePosition ? ` · ${data.routePosition}ª parada` : ""}
              </p>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <span className="text-sm font-medium">
                {SERVICE_ORDER_STATUS_LABEL[data.status]}
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {formatCurrencyBRL(data.totalCents)}
              </span>
            </div>

            <div className="space-y-2">
              <Linha Icon={MapPin}>
                {data.address}
                {data.cep ? ` · CEP ${data.cep}` : ""}
              </Linha>
              {data.leadPhone && <Linha Icon={Phone}>{data.leadPhone}</Linha>}
              <Linha Icon={Wrench}>
                {data.technicianNames.length > 0
                  ? data.technicianNames.join(" + ")
                  : "Sem técnico alocado"}
                {data.consultantName ? ` · vendeu: ${data.consultantName}` : ""}
              </Linha>
              {data.voltage && <Linha Icon={Zap}>Residência {data.voltage}</Linha>}
              {(data.partnerStore || data.partnerSellerName) && (
                <Linha Icon={Store}>
                  Indicação: {data.partnerStore ?? "loja não informada"}
                  {data.partnerSellerName ? ` · vendedor ${data.partnerSellerName}` : ""}
                  {data.partnerCommissionPercent != null
                    ? ` · ${String(data.partnerCommissionPercent).replace(".", ",")}% negociado`
                    : ""}
                </Linha>
              )}
              {data.signerName && (
                <Linha Icon={PenLine}>Assinado por {data.signerName}</Linha>
              )}
            </div>

            {(originais.length > 0 || upsell.length > 0) && (
              <div className="space-y-1.5 rounded-lg border border-border/70 p-3">
                {originais.map((item) => (
                  <div key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-muted-foreground">
                      {item.quantity > 1 ? `${item.quantity}× ` : ""}
                      {item.description}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrencyBRL(item.amountCents)}
                    </span>
                  </div>
                ))}
                {upsell.map((item) => (
                  <div key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-muted-foreground">
                      {item.quantity > 1 ? `${item.quantity}× ` : ""}
                      {item.description}
                      <span
                        className={
                          item.approved
                            ? "ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
                            : "ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-warning"
                        }
                      >
                        {item.approved ? "extra aprovado" : "extra a conferir"}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrencyBRL(item.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {data.observations && (
              <div className="rounded-lg bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {data.observations}
                </p>
              </div>
            )}

            <Link
              href={`/os/${data.id}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border/70 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir a página da OS para editar
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
