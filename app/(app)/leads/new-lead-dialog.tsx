"use client";

import { useId, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLead } from "./actions";
import { notify, notifyError } from "@/lib/ui/feedback";
import { formatPhoneBR } from "@/lib/utils";

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function NewLeadDialog({
  stages,
  partners = [],
  members = [],
  sources = [],
  canAssign = false,
}: {
  stages: { id: string; name: string }[];
  partners?: { id: string; kind: "loja" | "vendedor"; name: string }[];
  members?: { id: string; name: string }[];
  sources?: string[];
  canAssign?: boolean;
}) {
  const sourceListId = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [stageId, setStageId] = useState<string>(stages[0]?.id ?? "");
  const [partnerId, setPartnerId] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [money, setMoney] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (stageId) fd.set("stage_id", stageId);
    if (partnerId) fd.set("referred_by_partner_id", partnerId);
    if (assignedTo) fd.set("assigned_to", assignedTo);
    if (money) fd.set("value", money.replace(/\./g, "").replace(",", "."));
    start(async () => {
      try {
        const result = await createLead(fd);
        if (!result.ok) {
          notifyError(result.error);
          return;
        }
        notify({ title: "Lead criado com sucesso." });
        setOpen(false);
        setPartnerId("");
        setAssignedTo("");
        setPhone("");
        setMoney("");
      } catch (error) {
        console.error("[leads] Erro inesperado ao criar lead", error);
        notifyError("Não foi possível criar o lead agora. Tente novamente.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <Plus className="h-4 w-4" /> Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" autoComplete="name" autoFocus required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                value={phone}
                onChange={(event) => setPhone(formatPhoneBR(event.target.value.replace(/\D/g, "").slice(0, 13)))}
                placeholder="(51) 99999-9999"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estágio</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value_cents">Valor (R$)</Label>
              <Input
                id="value_cents"
                value={money}
                onChange={(event) => setMoney(formatMoneyInput(event.target.value))}
                placeholder="0,00"
                inputMode="decimal"
                aria-describedby="value-help"
              />
              <p id="value-help" className="sr-only">Informe o valor estimado em reais.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source">Origem</Label>
            <Input id="source" name="source" list={sourceListId} placeholder="Busque ou informe uma nova origem" />
            <datalist id={sourceListId}>
              {sources.map((source) => <option key={source} value={source} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">Selecione uma origem já usada ou cadastre uma nova.</p>
          </div>
          {canAssign && members.length > 0 && (
            <div className="space-y-1.5">
              <Label>Responsável inicial</Label>
              <Select value={assignedTo || "automatic"} onValueChange={(value) => setAssignedTo(value === "automatic" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Distribuição automática</SelectItem>
                  {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {partners.length > 0 && (
            <div className="space-y-1.5">
              <Label>Indicação (loja/vendedor)</Label>
              <Select value={partnerId || "none"} onValueChange={(v) => setPartnerId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.kind === "loja" ? "Loja" : "Vendedor"} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Com indicação marcada, o lead fica sem atendente até a coordenadora distribuir manualmente.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Salvando..." : "Criar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
