"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateProduct } from "../actions";
import { notify, notifyError } from "@/lib/ui/feedback";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price_cents: number;
  cost_cents: number;
  min_stock: number;
  tone: string | null;
  length_cm: number | null;
  texture: string | null;
};

export function EditProductDialog({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateProduct(product.id, fd);
        setOpen(false);
        notify({ title: "Produto atualizado", tone: "success" });
      } catch (err) {
        notifyError(err, "Nao foi possivel salvar as alteracoes.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Editar produto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nome *</Label>
            <Input id="edit-name" name="name" required defaultValue={product.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-sku">SKU</Label>
              <Input id="edit-sku" name="sku" defaultValue={product.sku ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-min_stock">Estoque minimo</Label>
              <Input id="edit-min_stock" name="min_stock" type="number" min="0" defaultValue={product.min_stock} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Preco (R$)</Label>
              <Input
                id="edit-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(product.price_cents / 100).toFixed(2)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cost">Custo (R$)</Label>
              <Input
                id="edit-cost"
                name="cost"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(product.cost_cents / 100).toFixed(2)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Descricao</Label>
            <Textarea id="edit-description" name="description" rows={3} defaultValue={product.description ?? ""} />
          </div>
          <details className="group rounded-lg border border-border/70 px-3 py-2">
            <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground group-open:text-foreground">
              Detalhes de cabelo (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-tone">Tonalidade</Label>
                <Input id="edit-tone" name="tone" defaultValue={product.tone ?? ""} placeholder="Ex.: castanho medio" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-length_cm">Comprimento (cm)</Label>
                <Input
                  id="edit-length_cm"
                  name="length_cm"
                  type="number"
                  min="1"
                  defaultValue={product.length_cm ?? ""}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="edit-texture">Textura</Label>
                <Input id="edit-texture" name="texture" defaultValue={product.texture ?? ""} placeholder="Ex.: liso, ondulado" />
              </div>
            </div>
          </details>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
