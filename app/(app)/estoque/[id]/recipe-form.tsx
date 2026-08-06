"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveProductRecipe } from "../actions";
import { notify, notifyError } from "@/lib/ui/feedback";

type MaterialOption = { id: string; name: string };
type RecipeItem = { materialProductId: string; quantity: number };

export function RecipeForm({
  productId,
  materials,
  initialItems,
}: {
  productId: string;
  materials: MaterialOption[];
  initialItems: RecipeItem[];
}) {
  const [items, setItems] = useState<RecipeItem[]>(
    initialItems.length > 0 ? initialItems : [{ materialProductId: materials[0]?.id ?? "", quantity: 1 }],
  );
  const [pending, start] = useTransition();

  function addRow() {
    setItems((current) => [...current, { materialProductId: materials[0]?.id ?? "", quantity: 1 }]);
  }

  function removeRow(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<RecipeItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await saveProductRecipe(productId, items);
        notify({ title: "Receita salva", tone: "success" });
      } catch (err) {
        notifyError(err);
      }
    });
  }

  if (materials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre outros produtos (materia-prima) pra poder montar a receita deste.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[1fr,100px,auto] items-end gap-2">
          <div className="space-y-1.5">
            <Select
              value={item.materialProductId}
              onValueChange={(value) => updateRow(index, { materialProductId: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(index)} title="Remover item">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4" /> Adicionar item
        </Button>
        <Button type="submit" variant="brand" size="sm" disabled={pending}>
          <Save className="h-4 w-4" /> {pending ? "Salvando..." : "Salvar receita"}
        </Button>
      </div>
    </form>
  );
}
