"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createStockLocation, deleteStockLocation } from "./actions";
import { confirmDialog, notifyError } from "@/lib/ui/feedback";

type Location = { id: string; name: string; is_default: boolean };

export function StockLocationsManager({ locations }: { locations: Location[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      try {
        await createStockLocation(name);
        setName("");
      } catch (err) {
        notifyError(err);
      }
    });
  }

  async function onDelete(id: string) {
    const confirmed = await confirmDialog({
      title: "Excluir este local de estoque?",
      tone: "danger",
      confirmLabel: "Excluir",
    });
    if (!confirmed) return;
    try {
      await deleteStockLocation(id);
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Locais de estoque
        </CardTitle>
        <CardDescription>Ex: Loja, Fábrica. Transfira estoque entre eles na página de cada produto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={onCreate} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do local" />
          <Button type="submit" variant="outline" disabled={pending}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {locations.map((loc) => (
            <span
              key={loc.id}
              className="flex items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-sm"
            >
              {loc.name}
              {loc.is_default && <Badge variant="outline" className="text-[10px]">padrão</Badge>}
              {!loc.is_default && (
                <button type="button" onClick={() => void onDelete(loc.id)} aria-label="Excluir local">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
