"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transferStock } from "../actions";
import { notify, notifyError } from "@/lib/ui/feedback";

type Location = { id: string; name: string };

export function TransferForm({ productId, locations }: { productId: string; locations: Location[] }) {
  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id ?? "");
  const [toLocationId, setToLocationId] = useState(locations[1]?.id ?? locations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (locations.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre mais de um local de estoque pra poder transferir entre eles.
      </p>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromLocationId === toLocationId) {
      notify({ title: "Origem e destino devem ser locais diferentes", tone: "error" });
      return;
    }
    start(async () => {
      try {
        await transferStock({ productId, fromLocationId, toLocationId, quantity, reason: reason || undefined });
        setQuantity(1);
        setReason("");
        notify({ title: "Transferencia realizada", tone: "success" });
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-5">
      <div className="space-y-1.5">
        <Label>De</Label>
        <Select value={fromLocationId} onValueChange={setFromLocationId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Para</Label>
        <Select value={toLocationId} onValueChange={setToLocationId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Quantidade</Label>
        <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>Motivo (opcional)</Label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reposicao da loja..." />
      </div>
      <div className="md:col-span-5">
        <Button type="submit" variant="brand" disabled={pending}>
          <ArrowRightLeft className="h-4 w-4" />
          {pending ? "Transferindo..." : "Transferir"}
        </Button>
      </div>
    </form>
  );
}
