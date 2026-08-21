"use client";

import { useState, useTransition } from "react";
import { Search, UserPlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify, notifyError } from "@/lib/ui/feedback";
import {
  createAndRouteLead,
  createPartner,
  searchPartners,
  type SellerOption,
  type PartnerRow,
} from "./actions";

const FOLDER_LABEL: Record<string, string> = {
  primeiro_contato: "Primeiro contato",
  reaplicacao: "Reaplicação",
  mkt: "MKT",
};

export function ProspeccaoForm({
  sellers,
  initialPartners,
}: {
  sellers: SellerOption[];
  initialPartners: PartnerRow[];
}) {
  const [pending, start] = useTransition();
  const [partners, setPartners] = useState(initialPartners);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [folder, setFolder] = useState<string>("primeiro_contato");
  const [sellerId, setSellerId] = useState<string>(sellers[0]?.id ?? "");
  const [showNewPartner, setShowNewPartner] = useState(false);
  const [partnerKind, setPartnerKind] = useState<"loja" | "vendedor">("loja");

  function runPartnerSearch(query: string) {
    setPartnerQuery(query);
    start(async () => {
      try {
        const results = await searchPartners(query);
        setPartners(results);
      } catch (err) {
        notifyError(err);
      }
    });
  }

  function submitLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sellerId) {
      notify({ title: "Escolha pra quem enviar o lead", tone: "error" });
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("sellerId", sellerId);
    fd.set("folder", folder);
    if (selectedPartnerId) fd.set("referredByPartnerId", selectedPartnerId);

    start(async () => {
      try {
        const result = await createAndRouteLead(fd);
        if (!result.ok) throw new Error(result.error);
        notify({ title: "Lead enviado", tone: "success" });
        (e.target as HTMLFormElement).reset();
        setSelectedPartnerId("");
      } catch (err) {
        notifyError(err);
      }
    });
  }

  function submitNewPartner(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("kind", partnerKind);
    start(async () => {
      try {
        const result = await createPartner(fd);
        if (!result.ok) throw new Error(result.error);
        notify({ title: "Parceiro cadastrado", tone: "success" });
        setPartners((prev) => [result.partner, ...prev]);
        setSelectedPartnerId(result.partner.id);
        setShowNewPartner(false);
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Novo lead</h2>
        <form onSubmit={submitLead} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" disabled={pending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="source">Origem</Label>
            <Input id="source" name="source" placeholder="Ex: indicação, Instagram..." disabled={pending} />
          </div>

          <div className="space-y-1.5">
            <Label>Parceiro que indicou (opcional)</Label>
            <Select value={selectedPartnerId || "none"} onValueChange={(v) => setSelectedPartnerId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.kind === "loja" ? "loja" : "vendedor"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Pasta</Label>
            <Select value={folder} onValueChange={setFolder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FOLDER_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Enviar para (vendedora) *</Label>
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a vendedora" />
              </SelectTrigger>
              <SelectContent>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cliente em emergência? Escolha aqui direto a vendedora que vai atender agora.
            </p>
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" variant="brand" disabled={pending} className="w-full sm:w-auto">
              <Send className="h-4 w-4" /> Cadastrar e enviar
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Parceiros (lojas / vendedores externos)</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowNewPartner((v) => !v)}>
            <UserPlus className="h-3.5 w-3.5" /> Novo parceiro
          </Button>
        </div>

        {showNewPartner && (
          <form onSubmit={submitNewPartner} className="mb-4 grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={partnerKind} onValueChange={(v) => setPartnerKind(v as "loja" | "vendedor")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loja">Loja parceira</SelectItem>
                  <SelectItem value="vendedor">Vendedor externo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-name">Nome *</Label>
              <Input id="partner-name" name="name" required disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-phone">Telefone</Label>
              <Input id="partner-phone" name="phone" disabled={pending} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" size="sm" disabled={pending}>
                Salvar parceiro
              </Button>
            </div>
          </form>
        )}

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={partnerQuery}
            onChange={(e) => runPartnerSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {partners.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">Nenhum parceiro encontrado.</li>
          )}
          {partners.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm">
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.kind === "loja" ? "Loja" : "Vendedor"} {p.phone ? `· ${p.phone}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
