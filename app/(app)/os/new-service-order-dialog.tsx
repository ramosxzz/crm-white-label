"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { notifyError } from "@/lib/ui/feedback";
import { ServiceOrderAddressFields } from "@/components/field-service/service-order-address-fields";
import type { FieldServiceUser } from "@/lib/field-service/users";
import { createServiceOrder } from "./actions";

type LeadOption = { id: string; name: string; phone: string | null };

/**
 * Criacao de OS. Dois modos: com `leads` mostra o select (tela /os) e com
 * `lead` o cliente ja vem travado (botao dentro do chat do WhatsApp).
 */
export function NewServiceOrderDialog({
  leads,
  lead,
  consultants,
  trigger,
}: {
  leads?: LeadOption[];
  lead?: LeadOption;
  consultants: FieldServiceUser[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const id = await createServiceOrder(fd);
        setOpen(false);
        router.push(`/os/${id}`);
      } catch (error) {
        notifyError(error, "Não foi possível criar a OS");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <Plus className="h-4 w-4" /> Nova OS
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ordem de serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {lead ? (
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{lead.name}</p>
                {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
              </div>
              <input type="hidden" name="lead_id" value={lead.id} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="lead_id">Cliente *</Label>
              <select
                id="lead_id"
                name="lead_id"
                required
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Selecione o cliente</option>
                {(leads ?? []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.phone ? ` — ${option.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="consultant_id">Consultora</Label>
              <select
                id="consultant_id"
                name="consultant_id"
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Sem consultora</option>
                {consultants.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voltage">Voltagem da residência</Label>
              <select
                id="voltage"
                name="voltage"
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Não informada</option>
                <option value="110v">110v</option>
                <option value="220v">220v</option>
              </select>
            </div>
          </div>

          <ServiceOrderAddressFields />

          <div className="space-y-1.5">
            <Label htmlFor="deadline">Prazo</Label>
            <Input id="deadline" name="deadline" type="date" />
          </div>

          {/* A comissao externa e negociada indicacao a indicacao, entao o
              percentual fica na OS: no faturamento ele vence a regra geral. */}
          <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Indicação
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="partner_store">Loja parceira</Label>
                <Input id="partner_store" name="partner_store" placeholder="Quem indicou" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner_seller_name">Vendedor externo</Label>
                <Input
                  id="partner_seller_name"
                  name="partner_seller_name"
                  placeholder="Quem recebe a comissão"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner_commission_percent">Comissão negociada (%)</Label>
              <Input
                id="partner_commission_percent"
                name="partner_commission_percent"
                type="number"
                min={0}
                max={100}
                step="0.5"
                inputMode="decimal"
                placeholder="Em branco usa o percentual padrão da empresa"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Vale só para esta OS. Deixando em branco, o faturamento usa o percentual
                cadastrado em Financeiro.
              </p>
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              name="observations"
              rows={3}
              placeholder="O que foi combinado na venda, ofertas feitas, avisos pro técnico"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Criando..." : "Criar OS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
