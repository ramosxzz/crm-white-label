"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLead } from "./actions";
import { notify, notifyError } from "@/lib/ui/feedback";

export function NewLeadDialog({
  stages,
  partners = [],
}: {
  stages: { id: string; name: string }[];
  partners?: { id: string; kind: "loja" | "vendedor"; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [stageId, setStageId] = useState<string>(stages[0]?.id ?? "");
  const [partnerId, setPartnerId] = useState<string>("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (stageId) fd.set("stage_id", stageId);
    if (partnerId) fd.set("referred_by_partner_id", partnerId);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" name="phone" placeholder="11999999999" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estagio</Label>
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
              <Input id="value_cents" name="value_cents" type="number" step="0.01" min="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source">Origem</Label>
            <Input id="source" name="source" placeholder="instagram, indicacao, site..." />
          </div>
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
            <Label htmlFor="notes">Observacoes</Label>
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
