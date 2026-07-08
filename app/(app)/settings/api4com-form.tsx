"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateApi4comExtension } from "./actions";

export function Api4comForm({ currentExtension }: { currentExtension: string }) {
  const [extension, setExtension] = useState(currentExtension);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        await updateApi4comExtension(extension);
        setMsg("Ramal salvo com sucesso.");
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="api4com-extension">Seu ramal na Api4com</Label>
        <Input
          id="api4com-extension"
          value={extension}
          onChange={(e) => setExtension(e.target.value)}
          placeholder="Ex: 1000"
        />
        <p className="text-xs text-muted-foreground">
          Necessario para usar o botao de ligar nos leads. Instale a extensao Api4com no navegador e confira seu ramal.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{msg}</p>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </form>
  );
}
