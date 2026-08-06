"use client";

import { useState, useTransition } from "react";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { produceProduct } from "../actions";
import { notify, notifyError } from "@/lib/ui/feedback";

type Location = { id: string; name: string };

export function ProduceForm({
  productId,
  locations,
  hasRecipe,
}: {
  productId: string;
  locations: Location[];
  hasRecipe: boolean;
}) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [pending, start] = useTransition();

  if (!hasRecipe) {
    return <p className="text-sm text-muted-foreground">Cadastre a receita deste produto pra poder fabricar.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await produceProduct({ productId, locationId, quantity });
        notify({ title: `${quantity} unidade(s) fabricada(s)`, tone: "success" });
        setQuantity(1);
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr,120px,auto]">
      <div className="space-y-1.5">
        <Label>Local (materia-prima e produto pronto)</Label>
        <Select value={locationId} onValueChange={setLocationId}>
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
      <div className="flex items-end">
        <Button type="submit" variant="brand" disabled={pending || !locationId}>
          <Hammer className="h-4 w-4" /> {pending ? "Fabricando..." : "Fabricar"}
        </Button>
      </div>
    </form>
  );
}
