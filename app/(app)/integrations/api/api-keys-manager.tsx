"use client";

import { confirmDialog } from "@/lib/ui/feedback";
import { useState, useTransition } from "react";
import { Copy, Plus, Power, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApiKey } from "@/lib/supabase/database.types";
import { API_SCOPES, type ApiScope } from "@/lib/api/scopes";
import { createApiKey, deleteApiKey, revokeApiKey } from "./actions";

const SCOPE_LABELS: Record<ApiScope, string> = {
  "leads:read": "Ler leads",
  "leads:write": "Criar/editar leads",
  "messages:read": "Ler mensagens",
  "messages:write": "Enviar mensagens",
  "automations:trigger": "Disparar automacoes",
  "pipelines:read": "Ler funis/etapas",
  "webhooks:manage": "Gerenciar webhooks de saida",
};

export function ApiKeysManager({ keys, canEdit }: { keys: ApiKey[]; canEdit: boolean }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<ApiScope>>(new Set(["leads:read", "leads:write", "pipelines:read"]));
  const [pending, start] = useTransition();
  const [freshKey, setFreshKey] = useState<string | null>(null);

  function toggleScope(scope: ApiScope) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || scopes.size === 0) return;
    start(async () => {
      const { key } = await createApiKey({ name, scopes: [...scopes] });
      setFreshKey(key);
      setName("");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Nova chave</CardTitle>
          <CardDescription>Gere uma chave para conectar um sistema externo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Nome interno</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Integracao ERP"
                required
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Permissoes</Label>
              <div className="space-y-1.5">
                {API_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-brand"
                      checked={scopes.has(scope)}
                      onChange={() => toggleScope(scope)}
                      disabled={!canEdit}
                    />
                    {SCOPE_LABELS[scope]}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={!canEdit || pending}>
              <Plus className="h-4 w-4" /> {pending ? "Gerando..." : "Gerar chave"}
            </Button>
          </form>

          {freshKey && (
            <div className="mt-4 space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" /> Copie agora — não mostraremos de novo
              </div>
              <code className="block break-all rounded-md bg-background/70 px-2 py-1.5 font-mono text-[11px]">
                {freshKey}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => navigator.clipboard.writeText(freshKey)}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar chave
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Chaves ({keys.length})</CardTitle>
          <CardDescription>
            Use no header <code className="rounded bg-muted px-1">Authorization: Bearer &lt;chave&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {keys.length === 0 && (
            <p className="rounded-md border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma chave criada ainda.
            </p>
          )}
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/50 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{k.name}</span>
                  {k.is_active ? <Badge variant="success">Ativa</Badge> : <Badge variant="outline">Revogada</Badge>}
                </div>
                <code className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                  {k.key_prefix}••••••••••••••••
                </code>
                <div className="mt-1 flex flex-wrap gap-1">
                  {k.scopes.map((s) => (
                    <span key={s} className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              {canEdit && (
                <>
                  {k.is_active && (
                    <Button variant="ghost" size="icon" onClick={() => void revokeApiKey(k.id)} aria-label="Revogar">
                      <Power className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => { if (await confirmDialog({ title: "Excluir chave?", tone: "danger", confirmLabel: "Excluir" })) void deleteApiKey(k.id); }}
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
