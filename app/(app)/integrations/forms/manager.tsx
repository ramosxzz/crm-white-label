"use client";

import { confirmDialog } from "@/lib/ui/feedback";
import { useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Plus, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LeadIntakeKey } from "@/lib/supabase/database.types";
import { createIntakeKey, deleteIntakeKey, toggleIntakeKey } from "./actions";

export function IntakeKeysManager({ keys, canEdit }: { keys: LeadIntakeKey[]; canEdit: boolean }) {
  const [name, setName] = useState("");
  const [source, setSource] = useState("Site Solaire W+");
  const [pending, start] = useTransition();
  const [show, setShow] = useState<Record<string, boolean>>({});

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      await createIntakeKey({ name, source_label: source });
      setName("");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Nova chave</CardTitle>
          <CardDescription>Gere uma chave para um novo canal/site.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Nome interno</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Site institucional" required disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Origem (source)</Label>
              <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Site Solaire W+" disabled={!canEdit} />
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={!canEdit || pending}>
              <Plus className="h-4 w-4" /> {pending ? "Gerando..." : "Gerar chave"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Chaves ativas ({keys.length})</CardTitle>
          <CardDescription>Use no header <code className="rounded bg-muted px-1">x-api-key</code>.</CardDescription>
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
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.name}</span>
                  {k.is_active ? <Badge variant="success">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                  <span className="text-[11px] text-muted-foreground">· {k.source_label}</span>
                </div>
                <code className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                  {show[k.id] ? k.api_key : "•".repeat(48)}
                </code>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShow((s) => ({ ...s, [k.id]: !s[k.id] }))} aria-label="Ver chave">
                {show[k.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(k.api_key)} aria-label="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
              {canEdit && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => void toggleIntakeKey(k.id, !k.is_active)} aria-label="Ligar/desligar">
                    <Power className={k.is_active ? "h-4 w-4 text-success" : "h-4 w-4 text-muted-foreground"} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => { if (await confirmDialog({ title: "Excluir chave?", tone: "danger", confirmLabel: "Excluir" })) void deleteIntakeKey(k.id); }}
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
