"use client";

import { confirmDialog } from "@/lib/ui/feedback";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Megaphone, Mic, Music, Save, Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { QuickMessage } from "@/lib/supabase/database.types";
import {
  deleteMessageTemplate,
  getCampaignRecipients,
  saveMessageTemplate,
  startBroadcast,
} from "./actions";

type Lead = { id: string; name: string; phone: string | null };
type Template = { id: string; name: string; body: string };
type Account = { id: string; display_name: string | null; phone_number: string };
type Recipient = {
  id: string;
  phone: string;
  status: string;
  error: string | null;
  leads: { name: string } | null;
};

const POLL_MS = 2500;

export function DisparoScreen({
  leads,
  quickMessages,
  templates: initialTemplates,
  accounts,
}: {
  leads: Lead[];
  quickMessages: QuickMessage[];
  templates: Template[];
  accounts: Account[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [mode, setMode] = useState<"text" | "quick_message">("text");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [quickMessageId, setQuickMessageId] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [log, setLog] = useState<Recipient[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.phone ?? "").toLowerCase().includes(q),
    );
  }, [leads, search]);

  function toggleLead(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const l of filteredLeads) next.add(l.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function onPickTemplate(id: string) {
    setSelectedTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setBodyText(t.body);
      setTemplateName(t.name);
    }
  }

  async function onSaveTemplate() {
    setError(null);
    try {
      await saveMessageTemplate({
        id: selectedTemplateId || undefined,
        name: templateName || "Modelo sem nome",
        body: bodyText,
      });
      // Recarrega a lista local (server action ja revalida a pagina, mas
      // aqui atualizamos o estado sem esperar o proximo load).
      setTemplates((prev) => {
        const exists = prev.find((t) => t.id === selectedTemplateId);
        if (exists) return prev.map((t) => (t.id === selectedTemplateId ? { ...t, name: templateName, body: bodyText } : t));
        return [...prev, { id: crypto.randomUUID(), name: templateName, body: bodyText }];
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function onDeleteTemplate() {
    if (!selectedTemplateId) return;
    if (!(await confirmDialog({ title: "Remover este modelo?", tone: "danger", confirmLabel: "Remover" }))) return;
    await deleteMessageTemplate(selectedTemplateId);
    setTemplates((prev) => prev.filter((t) => t.id !== selectedTemplateId));
    setSelectedTemplateId("");
  }

  function onNewTemplate() {
    setSelectedTemplateId("");
    setTemplateName("");
    setBodyText("");
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollLog(id: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const recipients = await getCampaignRecipients(id);
      setLog(recipients);
      const stillPending = recipients.some((r) => r.status === "pending");
      if (!stillPending) stopPolling();
    }, POLL_MS);
  }

  useEffect(() => stopPolling, []);

  async function onFire() {
    setError(null);
    if (selectedIds.size === 0) {
      setError("Selecione ao menos um lead");
      return;
    }
    if (mode === "text" && !bodyText.trim()) {
      setError("Escreva a mensagem");
      return;
    }
    if (mode === "quick_message" && !quickMessageId) {
      setError("Selecione a mensagem rapida");
      return;
    }
    setPending(true);
    try {
      const { campaignId: id } = await startBroadcast({
        messageMode: mode,
        bodyText: mode === "text" ? bodyText : undefined,
        quickMessageId: mode === "quick_message" ? quickMessageId : undefined,
        accountId: accountId || undefined,
        delaySeconds,
        leadIds: [...selectedIds],
      });
      setCampaignId(id);
      setSelectedIds(new Set());
      const recipients = await getCampaignRecipients(id);
      setLog(recipients);
      pollLog(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Enviar mensagem
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione uma sessão conectada, escolha os leads e envie com intervalo entre mensagens.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Sessão para envio</Label>
            <Select value={accountId} onValueChange={setAccountId} disabled={accounts.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={accounts.length === 0 ? "Nenhuma sessão conectada" : "Selecione a sessão"} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.display_name || a.phone_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "text" ? "brand" : "outline"} onClick={() => setMode("text")}>
              Texto
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "quick_message" ? "brand" : "outline"}
              onClick={() => setMode("quick_message")}
            >
              Mensagem rápida / áudio
            </Button>
          </div>

          {mode === "text" ? (
            <div className="space-y-3 rounded-lg border border-border/70 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Modelo salvo</Label>
                  <Select value={selectedTemplateId} onValueChange={onPickTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nome do modelo</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: Reativação de lead"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={onNewTemplate}>
                  Novo modelo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void onSaveTemplate()}>
                  <Save className="h-3.5 w-3.5" /> Salvar / atualizar
                </Button>
                {selectedTemplateId && (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => void onDeleteTemplate()}>
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mensagem</Label>
                <Textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Ola {{first_name}}, tudo bem?"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Variaveis disponiveis: {"{{name}}"}, {"{{first_name}}"}, {"{{phone}}"}, {"{{email}}"}, {"{{source}}"}.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-border/70 p-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mensagem rápida</Label>
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
                <p className="text-xs text-muted-foreground">
                  Nenhuma mensagem rapida cadastrada em /mensagens-rapidas.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Intervalo</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value) || 10)}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">segundos (10 é o recomendado)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lead por nome ou telefone..."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={selectVisible}>
              Selecionar visíveis
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clearSelection}>
              Limpar seleção
            </Button>
            <Button type="button" size="sm" onClick={() => void onFire()} disabled={pending} className="ml-auto">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Disparar selecionados
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border/70">
            {filteredLeads.map((l) => (
              <label
                key={l.id}
                className={cn(
                  "flex items-center gap-3 border-b border-border/50 px-3 py-2 text-sm last:border-b-0 hover:bg-muted/30",
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-brand"
                  checked={selectedIds.has(l.id)}
                  onChange={() => toggleLead(l.id)}
                />
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{l.phone}</span>
              </label>
            ))}
            {filteredLeads.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum lead encontrado.</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedIds.size} lead{selectedIds.size === 1 ? "" : "s"} selecionado{selectedIds.size === 1 ? "" : "s"} para envio
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {campaignId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Log de envio</span>
              {log.some((r) => r.status === "pending") && (
                <Button type="button" size="sm" variant="outline" onClick={() => void cancelAndStop(campaignId, stopPolling)}>
                  <Square className="h-3.5 w-3.5" /> Parar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {log.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{r.leads?.name ?? r.phone}</span>
                <span
                  className={
                    r.status === "sent"
                      ? "text-success"
                      : r.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }
                  title={r.error ?? undefined}
                >
                  {r.status === "sent" ? "Enviada" : r.status === "failed" ? "Falhou" : "Pendente"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function cancelAndStop(campaignId: string, stop: () => void) {
  const { cancelCampaign } = await import("./actions");
  await cancelCampaign(campaignId);
  stop();
}
