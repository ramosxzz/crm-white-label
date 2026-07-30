"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/lib/utils";
import { SERVICE_ORDER_STATUS_LABEL } from "@/lib/field-service/status";
import { notify, notifyError } from "@/lib/ui/feedback";
import type { FieldServicePartner, ServiceOrderStatus } from "@/lib/supabase/database.types";
import { updatePartner } from "../actions";

export type ReferredOrder = {
  id: string;
  code: string;
  leadName: string;
  status: ServiceOrderStatus;
  totalCents: number;
  createdAt: string;
  /** Comissão deste parceiro nesta OS especificamente - null se ainda não faturou. */
  commissionCents: number | null;
  commissionStatus: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Ficha do parceiro: edição + relatório do que ele indicou.
 *
 * Pedido do cliente por áudio: "eu conseguisse tá buscando as informações
 * desse vendedor, do que foi indicado dele" - essa tela é exatamente isso,
 * somando o que ele trouxe (linhas em `referred`) e quanto já gerou de
 * comissão pra ele.
 */
export function PartnerDetail({
  partner,
  stores,
  referred,
  canSeeCommissions,
}: {
  partner: FieldServicePartner;
  stores: { id: string; name: string }[];
  referred: ReferredOrder[];
  /** Comissao e dado financeiro: RLS so libera pra owner/admin, igual ao /financeiro. */
  canSeeCommissions: boolean;
}) {
  const [pending, start] = useTransition();
  const storeName = partner.store_id ? stores.find((s) => s.id === partner.store_id)?.name : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", partner.id);
    start(async () => {
      try {
        await updatePartner(fd);
        notify({ title: "Salvo", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível salvar");
      }
    });
  }

  async function copyPix() {
    if (!partner.pix_key) return;
    try {
      await navigator.clipboard.writeText(partner.pix_key);
      notify({ title: "Chave PIX copiada", tone: "success" });
    } catch {
      notify({ title: "Não foi possível copiar", tone: "error" });
    }
  }

  const referredTotal = referred.reduce((sum, o) => sum + o.totalCents, 0);
  const commissionTotal = referred.reduce((sum, o) => sum + (o.commissionCents ?? 0), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={partner.name} required />
        </div>
        {storeName && (
          <div className="space-y-1.5">
            <Label>Loja</Label>
            <p className="text-sm text-muted-foreground">{storeName}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" defaultValue={partner.phone ?? ""} placeholder="(51) 99999-9999" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pix_key">Chave PIX</Label>
          <div className="flex gap-2">
            <Input
              id="pix_key"
              name="pix_key"
              defaultValue={partner.pix_key ?? ""}
              placeholder="Telefone, e-mail, CPF/CNPJ ou aleatória"
            />
            {partner.pix_key && (
              <Button type="button" variant="outline" size="icon" onClick={copyPix} title="Copiar chave">
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <Button type="submit" variant="brand" disabled={pending} className="w-full">
          <Save className="h-4 w-4" />
          {pending ? "Salvando..." : "Salvar"}
        </Button>

        <div className="grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Clientes indicados</p>
            <p className="font-semibold">{referred.length}</p>
          </div>
          {canSeeCommissions && (
            <div>
              <p className="text-xs text-muted-foreground">Comissão gerada</p>
              <p className="font-semibold">{formatCurrencyBRL(commissionTotal)}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Valor total das OS</p>
            <p className="font-semibold">{formatCurrencyBRL(referredTotal)}</p>
          </div>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
        <header className="border-b border-border/70 px-5 py-3">
          <h2 className="text-sm font-semibold">Clientes indicados</h2>
        </header>
        {referred.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhuma OS ligada a este parceiro ainda.
          </p>
        ) : (
          <div className="divide-y divide-border/70">
            {referred.map((o) => (
              <Link
                key={o.id}
                href={`/os/${o.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.leadName}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.code} · {formatDate(o.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="outline">{SERVICE_ORDER_STATUS_LABEL[o.status]}</Badge>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{formatCurrencyBRL(o.totalCents)}</p>
                    {canSeeCommissions && o.commissionCents != null && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        comissão {formatCurrencyBRL(o.commissionCents)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
