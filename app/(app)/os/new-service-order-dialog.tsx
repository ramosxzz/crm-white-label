"use client";

import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { ServiceOrderAddressFields } from "@/components/field-service/service-order-address-fields";
import type { FieldServiceUser } from "@/lib/field-service/users";
import type { FieldServicePartner } from "@/lib/supabase/database.types";
import { deriveShiftFromTime } from "@/lib/field-service/agenda";
import { SALE_CHANNEL_LABEL } from "@/lib/field-service/status";
import { createServiceOrder, scheduleServiceOrder } from "./actions";
import { MiniAgenda, type MiniAgendaSelection } from "./mini-agenda";

type LeadOption = { id: string; name: string; phone: string | null };

/**
 * Criacao de OS. Dois modos: com `leads` mostra o select (tela /os) e com
 * `lead` o cliente ja vem travado (botao dentro do chat do WhatsApp).
 *
 * Modo agenda: `agendaPreset` chega da Agenda (clique direito numa coluna de
 * tecnico) - o dialogo abre sem trigger proprio (controlado por `open`), com
 * o tecnico e o dia ja escolhidos, e pede so o horario pra ja agendar a OS
 * assim que ela e criada, sem precisar abrir a pagina da OS de novo so pra
 * isso.
 */
export function NewServiceOrderDialog({
  leads,
  lead,
  consultants,
  partners = [],
  trigger,
  open: controlledOpen,
  onOpenChange,
  agendaPreset,
  showMiniAgenda = false,
  lockedConsultant = null,
  leadReferral = null,
}: {
  leads?: LeadOption[];
  lead?: LeadOption;
  consultants: FieldServiceUser[];
  partners?: FieldServicePartner[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  agendaPreset?: { technicianId: string; technicianName: string; date: string; dateLabel: string };
  /** Abre com a agenda dos tecnicos embutida - usado no chat, onde a
   * vendedora fecha a venda e marca o horario na mesma tela. */
  showMiniAgenda?: boolean;
  /** Vendedora: a consultora e ela mesma, sem escolha. Ligar isso tambem
   * esconde os campos de indicacao/comissao - eles vem do que a prospeccao
   * cadastrou no lead, e ela so preenche endereco, observacao e horario. */
  lockedConsultant?: { id: string; name: string } | null;
  /** Indicacao que veio no lead (cadastrada pela prospeccao). */
  leadReferral?: { partnerId: string | null; source: string | null; pieces: string | null } | null;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [pending, start] = useTransition();
  const router = useRouter();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [miniAgenda, setMiniAgenda] = useState<MiniAgendaSelection | null>(null);

  // Modo simplificado (vendedora): consultora travada nela, indicacao e
  // origem vem do lead, e o formulario pede so o que ela de fato preenche.
  const simplified = Boolean(lockedConsultant);
  const referralPartner = leadReferral?.partnerId
    ? partners.find((p) => p.id === leadReferral.partnerId) ?? null
    : null;

  const stores = partners.filter((p) => p.kind === "loja" && p.is_active);
  const sellers = partners.filter((p) => p.kind === "vendedor" && p.is_active);
  const storeBySellerId = new Map(sellers.map((s) => [s.id, s.store_id]));

  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const bothSelected = Boolean(selectedStoreId) && Boolean(selectedSellerId);

  // Escolher um vendedor com loja cadastrada ja marca a loja dele - no
  // sistema antigo do cliente a busca de loja e parceiro era uma coisa so;
  // aqui e o mais perto disso sem duplicar a busca.
  function onSellerChange(id: string) {
    setSelectedSellerId(id);
    const storeId = id ? storeBySellerId.get(id) : null;
    if (storeId) setSelectedStoreId(storeId);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const id = await createServiceOrder(fd);
        // Agenda (clique direito na coluna do tecnico) ou mini agenda do
        // chat - os dois caminhos ja agendam a OS na hora de criar.
        const scheduling = agendaPreset
          ? {
              date: agendaPreset.date,
              technicianId: agendaPreset.technicianId,
              start: startTime,
              end: endTime,
            }
          : miniAgenda
            ? {
                date: miniAgenda.date,
                technicianId: miniAgenda.technicianId,
                start: miniAgenda.startTime,
                end: miniAgenda.endTime,
              }
            : null;

        if (scheduling) {
          const startAt = new Date(`${scheduling.date}T${scheduling.start}:00-03:00`).toISOString();
          const endAt = new Date(`${scheduling.date}T${scheduling.end}:00-03:00`).toISOString();
          await scheduleServiceOrder({
            id,
            service_date: scheduling.date,
            shift: deriveShiftFromTime(startAt),
            technician_ids: [scheduling.technicianId],
            scheduled_start_at: startAt,
            scheduled_end_at: endAt,
          });
        }
        setOpen(false);
        router.push(`/os/${id}`);
      } catch (error) {
        notifyError(error, "Não foi possível criar a OS");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!agendaPreset && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="brand">
              <Plus className="h-4 w-4" /> Nova OS
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova ordem de serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {agendaPreset && (
            <div className="space-y-2 rounded-lg border border-brand/30 bg-brand/5 p-3">
              <p className="text-sm">
                Agendando com <strong>{agendaPreset.technicianName}</strong> em{" "}
                <strong>{agendaPreset.dateLabel}</strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="agenda_start_time">Início</Label>
                  <Input
                    id="agenda_start_time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="agenda_end_time">Fim</Label>
                  <Input
                    id="agenda_end_time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}
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

          {simplified ? (
            <div className="space-y-1.5">
              <Label>Consultora</Label>
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{lockedConsultant!.name}</p>
                {referralPartner && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Indicação: {referralPartner.name}
                    {referralPartner.kind === "loja" ? " (loja parceira)" : " (vendedor da loja)"}
                  </p>
                )}
                {leadReferral?.pieces && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Peças: {leadReferral.pieces}</p>
                )}
              </div>
              <input type="hidden" name="consultant_id" value={lockedConsultant!.id} />
              {leadReferral?.partnerId && referralPartner && (
                <input
                  type="hidden"
                  name={referralPartner.kind === "loja" ? "partner_store_id" : "partner_seller_id"}
                  value={referralPartner.id}
                />
              )}
            </div>
          ) : (
            <>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="consultant_extra_id">Consultora extra</Label>
                  <select
                    id="consultant_extra_id"
                    name="consultant_extra_id"
                    className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                  >
                    <option value="">Nenhuma</option>
                    {consultants.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sale_channel">Origem do cliente</Label>
                  <select
                    id="sale_channel"
                    name="sale_channel"
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
              </div>
            </>
          )}

          <ServiceOrderAddressFields />

          {showMiniAgenda && !agendaPreset && (
            <MiniAgenda value={miniAgenda} onChange={setMiniAgenda} />
          )}

          {!simplified && (
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Prazo</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
          )}

          {/* A comissao externa e negociada indicacao a indicacao, entao o
              percentual fica na OS: no faturamento ele vence a regra geral.
              Escondido pra vendedora: comissao e coisa do escritorio. */}
          <fieldset className={cn("space-y-3 rounded-lg border border-border/70 p-3", simplified && "hidden")}>
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Indicação
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="partner_store_id">Loja parceira</Label>
                <select
                  id="partner_store_id"
                  name="partner_store_id"
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option value="">Nenhuma</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner_seller_id">Vendedor externo</Label>
                <select
                  id="partner_seller_id"
                  name="partner_seller_id"
                  value={selectedSellerId}
                  onChange={(e) => onSellerChange(e.target.value)}
                  className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option value="">Nenhum</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {stores.length === 0 && sellers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum parceiro cadastrado ainda —{" "}
                <Link href="/os/parceiros" className="text-brand underline">
                  cadastre em Parceiros
                </Link>
                . Indicação avulsa, sem repetir negócio, pode ser digitada abaixo.
              </p>
            )}

            {bothSelected && (
              <div className="space-y-1.5">
                <Label htmlFor="partner_store_split_percent">Fatia da loja na comissão (%)</Label>
                <Input
                  id="partner_store_split_percent"
                  name="partner_store_split_percent"
                  type="number"
                  min={0}
                  max={100}
                  step="5"
                  inputMode="decimal"
                  placeholder="Em branco divide 50/50"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  O resto vai pro vendedor. Ex.: 30 = loja fica com 30% da comissão de indicação, vendedor com 70%.
                </p>
              </div>
            )}

            {!selectedStoreId && !selectedSellerId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="partner_store">Ou loja avulsa (sem cadastro)</Label>
                  <Input id="partner_store" name="partner_store" placeholder="Quem indicou" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="partner_seller_name">Ou vendedor avulso</Label>
                  <Input
                    id="partner_seller_name"
                    name="partner_seller_name"
                    placeholder="Quem recebe a comissão"
                  />
                </div>
              </div>
            )}

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

            <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="partner_extra_name">Parceiro extra (opcional)</Label>
                <Input id="partner_extra_name" name="partner_extra_name" placeholder="Um segundo indicador, se houver" />
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
                  inputMode="decimal"
                />
              </div>
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
