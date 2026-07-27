"use client";

import { useState, useTransition } from "react";
import { Loader2, Megaphone, Mic, Music, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuickMessage } from "@/lib/supabase/database.types";
import { DISPARO_CAMPAIGN_PRESETS } from "@/lib/disparos/campaign-presets";
import { createCampaign, searchLeadsForBroadcast } from "./actions";

type LeadResult = { id: string; name: string; phone: string | null };

export function NewCampaignDialog({ quickMessages }: { quickMessages: QuickMessage[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"text" | "quick_message">("text");
  const [bodyText, setBodyText] = useState("");
  const [quickMessageId, setQuickMessageId] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<LeadResult[]>([]);
  const [selected, setSelected] = useState<Map<string, LeadResult>>(new Map());
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setName("");
    setMode("text");
    setBodyText("");
    setQuickMessageId("");
    setDelaySeconds(10);
    setSearch("");
    setResults([]);
    setSelected(new Map());
    setError(null);
  }

  async function onSearch(value: string) {
    setSearch(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const leads = await searchLeadsForBroadcast(value);
      setResults(leads);
    } finally {
      setSearching(false);
    }
  }

  function addLead(lead: LeadResult) {
    setSelected((prev) => new Map(prev).set(lead.id, lead));
  }

  function removeLead(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      try {
        await createCampaign({
          name,
          messageMode: mode,
          bodyText: mode === "text" ? bodyText : undefined,
          quickMessageId: mode === "quick_message" ? quickMessageId : undefined,
          delaySeconds,
          leadIds: [...selected.keys()],
        });
        setOpen(false);
        reset();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="brand">
          <Plus className="h-4 w-4" /> Nova campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Nova campanha de disparo
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem para varios leads, um de cada vez, com um intervalo entre os envios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reativacao de julho" />
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "text" ? "brand" : "outline"}
                onClick={() => setMode("text")}
              >
                Texto
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "quick_message" ? "brand" : "outline"}
                onClick={() => setMode("quick_message")}
              >
                Mensagem rapida
              </Button>
            </div>

            {mode === "text" ? (
              <div className="space-y-2 pt-2">
                <Select
                  value=""
                  onValueChange={(id) => {
                    const preset = DISPARO_CAMPAIGN_PRESETS.find((p) => p.id === id);
                    if (preset) setBodyText(preset.body);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Usar um modelo pronto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPARO_CAMPAIGN_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Ola {{first_name}}, tudo bem?"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variaveis: {"{{name}}"}, {"{{first_name}}"}, {"{{phone}}"}, {"{{email}}"}, {"{{source}}"}
                </p>
              </div>
            ) : (
              <div className="pt-2">
                <Select value={quickMessageId} onValueChange={setQuickMessageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma mensagem rapida" />
                  </SelectTrigger>
                  <SelectContent>
                    {quickMessages.map((qm) => (
                      <SelectItem key={qm.id} value={qm.id}>
                        <span className="flex items-center gap-1.5">
                          {qm.media_type === "audio" ? (
                            <Mic className="h-3.5 w-3.5" />
                          ) : qm.media_url ? (
                            <Music className="h-3.5 w-3.5" />
                          ) : null}
                          {qm.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {quickMessages.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nenhuma mensagem rapida cadastrada em /mensagens-rapidas.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Intervalo entre envios (segundos)</Label>
            <Input
              type="number"
              min={1}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value) || 10)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">10 segundos e o recomendado.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Destinatarios ({selected.size})</Label>
            <Input
              value={search}
              onChange={(e) => void onSearch(e.target.value)}
              placeholder="Buscar lead por nome ou telefone..."
            />
            {searching && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {results.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border/70">
                {results.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => addLead(lead)}
                    disabled={selected.has(lead.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/40 disabled:opacity-40"
                  >
                    <span>{lead.name}</span>
                    <span className="text-xs text-muted-foreground">{lead.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[...selected.values()].map((lead) => (
                  <span
                    key={lead.id}
                    className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand"
                  >
                    {lead.name}
                    <button type="button" onClick={() => removeLead(lead.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar disparo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
