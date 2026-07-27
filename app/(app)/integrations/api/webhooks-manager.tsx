"use client";

import { confirmDialog } from "@/lib/ui/feedback";
import { useState, useTransition } from "react";
import { Copy, Plus, Power, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApiWebhook } from "@/lib/supabase/database.types";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/api/webhook-events";
import { createWebhookSubscription, deleteWebhookSubscription, toggleWebhookSubscription } from "./actions";

const EVENT_LABELS: Record<WebhookEvent, string> = {
  "lead.created": "Lead criado",
  "lead.stage_changed": "Lead mudou de etapa",
  "message.received": "Mensagem recebida",
};

export function WebhooksManager({ webhooks, canEdit }: { webhooks: ApiWebhook[]; canEdit: boolean }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<WebhookEvent>>(new Set(WEBHOOK_EVENTS));
  const [pending, start] = useTransition();
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  function toggleEvent(event: WebhookEvent) {
    setEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || events.size === 0) return;
    start(async () => {
      const { secret } = await createWebhookSubscription({ url, events: [...events] });
      setFreshSecret(secret);
      setUrl("");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Novo webhook</CardTitle>
          <CardDescription>Seu sistema recebe um POST quando o evento acontecer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL de destino</Label>
              <Input
                id="webhook-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://seusistema.com/webhook"
                required
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Eventos</Label>
              <div className="space-y-1.5">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-brand"
                      checked={events.has(event)}
                      onChange={() => toggleEvent(event)}
                      disabled={!canEdit}
                    />
                    {EVENT_LABELS[event]}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={!canEdit || pending}>
              <Plus className="h-4 w-4" /> {pending ? "Criando..." : "Criar webhook"}
            </Button>
          </form>

          {freshSecret && (
            <div className="mt-4 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" /> Segredo (HMAC) — copie agora
              </div>
              <code className="block break-all rounded-md bg-background/70 px-2 py-1.5 font-mono text-[11px]">
                {freshSecret}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => navigator.clipboard.writeText(freshSecret)}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar segredo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Webhooks ({webhooks.length})</CardTitle>
          <CardDescription>
            Corpo assinado em <code className="rounded bg-muted px-1">X-Solaire-Signature</code> (HMAC-SHA256).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {webhooks.length === 0 && (
            <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum webhook cadastrado ainda.
            </p>
          )}
          {webhooks.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{w.url}</span>
                  {w.is_active ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Pausado</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {w.events.map((ev) => (
                    <span key={ev} className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {EVENT_LABELS[ev as WebhookEvent] ?? ev}
                    </span>
                  ))}
                </div>
              </div>
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void toggleWebhookSubscription(w.id, !w.is_active)}
                    aria-label="Ligar/desligar"
                  >
                    <Power className={w.is_active ? "h-4 w-4 text-success" : "h-4 w-4 text-muted-foreground"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => { if (await confirmDialog({ title: "Excluir webhook?", tone: "danger", confirmLabel: "Excluir" })) void deleteWebhookSubscription(w.id); }}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
