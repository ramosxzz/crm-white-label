"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, Loader2, Save } from "lucide-react";
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
import { ServiceOrderAddressFields } from "@/components/field-service/service-order-address-fields";
import { SALE_CHANNEL_LABEL } from "@/lib/field-service/status";
import { notify, notifyError } from "@/lib/ui/feedback";
import { updateServiceOrderAtendimento } from "../actions";
import type { FieldServiceUser } from "@/lib/field-service/users";

/**
 * "Tela da OS totalmente editavel" - dado digitado errado na hora da venda
 * (nome, telefone, voltagem, endereco...) so dava pra corrigir abrindo o
 * lead numa tela separada, e metade dos campos nem isso. Um modal so,
 * corrige tudo daqui.
 */
export function AtendimentoEditDialog({
  serviceOrderId,
  leadName,
  leadPhone,
  voltage,
  deadline,
  saleChannel,
  partnerStore,
  partnerExtraName,
  partnerExtraPercent,
  consultantId,
  consultantExtraId,
  technicianIds,
  address,
  consultants,
  technicians,
  open: controlledOpen,
  onOpenChange,
}: {
  serviceOrderId: string;
  leadName: string;
  leadPhone: string | null;
  voltage: string | null;
  deadline: string | null;
  saleChannel: string | null;
  partnerStore: string | null;
  partnerExtraName: string | null;
  partnerExtraPercent: number | null;
  consultantId: string | null;
  consultantExtraId: string | null;
  technicianIds: string[];
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
  consultants: FieldServiceUser[];
  technicians: FieldServiceUser[];
  /** Controlado por fora (ex.: menu de contexto da Agenda) - sem gatilho
      proprio nesse caso, quem chama decide quando abre. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [saving, setSaving] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState<string[]>(technicianIds);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggleTech(id: string) {
    setSelectedTechs((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("technician_ids", selectedTechs.join(","));
    setSaving(true);
    start(async () => {
      try {
        await updateServiceOrderAtendimento({ id: serviceOrderId, formData });
        notify({ title: "Atendimento atualizado", tone: "success" });
        setOpen(false);
        router.refresh();
      } catch (err) {
        notifyError(err, "Não foi possível salvar as alterações");
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title="Editar atendimento">
            <PencilLine className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar atendimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead_name">Nome do cliente</Label>
              <Input id="lead_name" name="lead_name" defaultValue={leadName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead_phone">Telefone</Label>
              <Input id="lead_phone" name="lead_phone" defaultValue={leadPhone ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="voltage">Voltagem</Label>
              <select
                id="voltage"
                name="voltage"
                defaultValue={voltage ?? ""}
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Não informada</option>
                <option value="110v">110v</option>
                <option value="220v">220v</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Prazo</Label>
              <Input id="deadline" name="deadline" type="date" defaultValue={deadline ?? ""} />
            </div>
          </div>

          <ServiceOrderAddressFields defaultValue={address} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="consultant_id">Consultora</Label>
              <select
                id="consultant_id"
                name="consultant_id"
                defaultValue={consultantId ?? ""}
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Sem consultora</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consultant_extra_id">Consultora extra</Label>
              <select
                id="consultant_extra_id"
                name="consultant_extra_id"
                defaultValue={consultantExtraId ?? ""}
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Nenhuma</option>
                {consultants.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Técnicos alocados</Label>
            <div className="flex flex-wrap gap-2">
              {technicians.map((t) => {
                const active = selectedTechs.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTech(t.id)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                      (active
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40")
                    }
                  >
                    {t.name}
                  </button>
                );
              })}
              {technicians.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum técnico cadastrado.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sale_channel">Origem do cliente</Label>
              <select
                id="sale_channel"
                name="sale_channel"
                defaultValue={saleChannel ?? ""}
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="">Não informada</option>
                {Object.entries(SALE_CHANNEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner_store">Loja parceira</Label>
              <Input id="partner_store" name="partner_store" defaultValue={partnerStore ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="partner_extra_name">Parceiro extra</Label>
              <Input id="partner_extra_name" name="partner_extra_name" defaultValue={partnerExtraName ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner_extra_percent">Comissão do parceiro extra (%)</Label>
              <Input
                id="partner_extra_percent"
                name="partner_extra_percent"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={partnerExtraPercent ?? ""}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || pending}>
              {saving || pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
