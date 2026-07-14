"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createProduct } from "./actions";

export function NewProductDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await createProduct(fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand"><Plus className="h-4 w-4" /> Novo produto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock_quantity">Estoque inicial</Label>
              <Input id="stock_quantity" name="stock_quantity" type="number" min="0" defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Preco (R$)</Label>
              <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={0} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost">Custo (R$)</Label>
              <Input id="cost" name="cost" type="number" step="0.01" min="0" defaultValue={0} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="min_stock">Estoque minimo</Label>
              <Input id="min_stock" name="min_stock" type="number" min="0" defaultValue={0} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Descricao</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <details className="group rounded-lg border border-border/70 px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground group-open:text-foreground">
              Detalhes de cabelo (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tone">Tonalidade</Label>
                <Input id="tone" name="tone" placeholder="Ex.: castanho medio" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="length_cm">Comprimento (cm)</Label>
                <Input id="length_cm" name="length_cm" type="number" min="1" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="texture">Textura</Label>
                <Input id="texture" name="texture" placeholder="Ex.: liso, ondulado" />
              </div>
            </div>
          </details>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Salvando..." : "Criar produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
