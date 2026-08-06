"use client";

import { useState, useTransition } from "react";
import { PackageMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordSaleStockMovement } from "@/lib/estoque/sale-stock-actions";
import { notify, notifyError } from "@/lib/ui/feedback";

export type SaleStockProduct = { id: string; name: string };
export type SaleStockLocation = { id: string; name: string; isDefault: boolean };

export function SaleStockDialog({
  leadId,
  leadName,
  products,
  locations,
  onClose,
}: {
  leadId: string;
  leadName: string;
  products: SaleStockProduct[];
  locations: SaleStockLocation[];
  onClose: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [locationId, setLocationId] = useState(
    locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !locationId) return;
    start(async () => {
      try {
        await recordSaleStockMovement({ leadId, productId, locationId, quantity });
        notify({ title: "Baixa registrada no estoque", tone: "success" });
        onClose();
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa no estoque</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Lead <span className="font-medium text-foreground">{leadName}</span> fechou. Qual produto foi vendido?
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado no estoque.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Local</Label>
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Pular</Button>
              <Button type="submit" variant="brand" disabled={pending || !locationId}>
                <PackageMinus className="h-4 w-4" /> {pending ? "Salvando..." : "Dar baixa"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
