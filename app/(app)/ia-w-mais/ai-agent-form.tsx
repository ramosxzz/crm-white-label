"use client";

import { useState, useTransition } from "react";
import { Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveAiAgent, toggleAiAgent } from "./actions";

export function AiAgentForm({
  initialName,
  initialPrompt,
  initialModel,
  initialEnabled,
  disabled,
}: {
  initialName: string;
  initialPrompt: string;
  initialModel: string;
  initialEnabled: boolean;
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();
  const [togglePending, startToggle] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startSave(async () => {
      await saveAiAgent(fd);
    });
  }

  function onToggle() {
    setError(null);
    const next = !enabled;
    startToggle(async () => {
      const result = await toggleAiAgent(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEnabled(next);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border/60 px-3.5 py-3">
        <div>
          <p className="text-sm font-medium">{enabled ? "Agente ativo" : "Agente desligado"}</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Respondendo automaticamente no WhatsApp." : "Nao esta respondendo leads."}
          </p>
        </div>
        <Button
          type="button"
          variant={enabled ? "outline" : "brand"}
          size="sm"
          onClick={onToggle}
          disabled={disabled || togglePending}
        >
          {togglePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          {enabled ? "Desligar" : "Ativar"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome do agente</Label>
          <Input id="name" name="name" defaultValue={initialName} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="system_prompt">Personalidade e instrucoes</Label>
          <Textarea
            id="system_prompt"
            name="system_prompt"
            rows={10}
            disabled={disabled}
            placeholder={
              "Ex.: Voce e a assistente virtual da Loja X. Responda de forma simpatica e objetiva sobre produtos, precos e horario de funcionamento (seg a sab, 9h as 18h). Se o cliente quiser falar com um humano, avise que a equipe vai continuar por aqui."
            }
            defaultValue={initialPrompt}
            className={cn("font-mono text-xs")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model">Modelo (opcional)</Label>
          <Input
            id="model"
            name="model"
            placeholder="meta/llama-3.3-70b-instruct"
            defaultValue={initialModel}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Deixe em branco para usar o padrao do servidor.</p>
        </div>
        <Button type="submit" disabled={disabled || savePending}>
          {savePending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </div>
  );
}
