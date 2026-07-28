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
import type { FieldServiceUser } from "@/lib/field-service/users";
import { createServiceOrder } from "./actions";

type LeadOption = { id: string; name: string; phone: string | null };

export function NewServiceOrderDialog({
  leads,
  consultants,
}: {
  leads: LeadOption[];
  consultants: FieldServiceUser[];
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
        <Button variant="brand">
          <Plus className="h-4 w-4" /> Nova OS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ordem de serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lead_id">Cliente *</Label>
            <select
              id="lead_id"
              name="lead_id"
              required
              className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
            >
              <option value="">Selecione o cliente</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                  {lead.phone ? ` — ${lead.phone}` : ""}
                </option>
              ))}
            </select>
          </div>

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

          <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Endereço do atendimento
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="address_street">Rua</Label>
                <Input id="address_street" name="address_street" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_number">Número</Label>
                <Input id="address_number" name="address_number" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_complement">Complemento</Label>
                <Input id="address_complement" name="address_complement" placeholder="Apto 401" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_district">Bairro</Label>
                <Input id="address_district" name="address_district" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_cep">CEP</Label>
                <Input id="address_cep" name="address_cep" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="address_city">Cidade</Label>
                <Input id="address_city" name="address_city" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_state">UF</Label>
                <Input id="address_state" name="address_state" maxLength={2} placeholder="RS" />
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Prazo</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner_store">Loja parceira</Label>
              <Input id="partner_store" name="partner_store" placeholder="Se veio por indicação" />
            </div>
          </div>

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
