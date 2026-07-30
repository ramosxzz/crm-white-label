"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Store, User, Trash2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import type { FieldServicePartner } from "@/lib/supabase/database.types";
import { createPartner, deletePartner, setPartnerActive } from "./actions";

export function PartnersPanel({ partners }: { partners: FieldServicePartner[] }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"loja" | "vendedor">("loja");
  const [pending, start] = useTransition();

  const lojas = useMemo(() => partners.filter((p) => p.kind === "loja"), [partners]);
  const vendedores = useMemo(() => partners.filter((p) => p.kind === "vendedor"), [partners]);
  const storeName = useMemo(() => new Map(lojas.map((l) => [l.id, l.name])), [lojas]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await createPartner(fd);
        setOpen(false);
        notify({ title: "Parceiro cadastrado", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível cadastrar");
      }
    });
  }

  // Fora da transicao de proposito: o confirmDialog abre por setState, e
  // dentro de start() esse setState nunca renderiza porque a transicao fica
  // esperando a resposta do dialogo que ela mesma esta bloqueando.
  async function remove(partner: FieldServicePartner) {
    const confirmed = await confirmDialog({
      title: `Remover "${partner.name}"?`,
      description: "Só é possível remover parceiros que nunca foram usados numa OS.",
      confirmLabel: "Remover",
      tone: "danger",
    });
    if (!confirmed) return;
    start(async () => {
      try {
        await deletePartner({ id: partner.id });
      } catch (error) {
        notifyError(error, "Não foi possível remover");
      }
    });
  }

  function toggleActive(partner: FieldServicePartner) {
    start(async () => {
      try {
        await setPartnerActive({ id: partner.id, is_active: !partner.is_active });
      } catch (error) {
        notifyError(error, "Não foi possível atualizar");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="brand">
            <Plus className="h-4 w-4" /> Novo parceiro
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo parceiro</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="kind">Tipo</Label>
              <select
                id="kind"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "loja" | "vendedor")}
                className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
              >
                <option value="loja">Loja</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required autoFocus />
            </div>
            {kind === "vendedor" && (
              <div className="space-y-1.5">
                <Label htmlFor="store_id">Loja (opcional)</Label>
                <select
                  id="store_id"
                  name="store_id"
                  className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option value="">Vendedor autônomo, sem loja</option>
                  {lojas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input id="phone" name="phone" placeholder="(51) 99999-9999" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={pending}>
                {pending ? "Salvando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 lg:grid-cols-2">
        <PartnerGroup
          title="Lojas"
          icon={Store}
          items={lojas}
          onRemove={remove}
          onToggleActive={toggleActive}
        />
        <PartnerGroup
          title="Vendedores"
          icon={User}
          items={vendedores}
          storeName={storeName}
          onRemove={remove}
          onToggleActive={toggleActive}
        />
      </div>
    </div>
  );
}

function PartnerGroup({
  title,
  icon: Icon,
  items,
  storeName,
  onRemove,
  onToggleActive,
}: {
  title: string;
  icon: typeof Store;
  items: FieldServicePartner[];
  storeName?: Map<string, string>;
  onRemove: (p: FieldServicePartner) => void;
  onToggleActive: (p: FieldServicePartner) => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-elev-1">
      <header className="flex items-center gap-2 border-b border-border/70 px-5 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          {title} <span className="text-muted-foreground">({items.length})</span>
        </h2>
      </header>
      <div className="divide-y divide-border/70">
        {items.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhum cadastrado ainda.
          </p>
        )}
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {storeName && p.store_id && <span>{storeName.get(p.store_id) ?? "Loja removida"}</span>}
                {p.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {p.phone}
                  </span>
                )}
                {!p.is_active && <Badge variant="outline">Inativo</Badge>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onToggleActive(p)}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {p.is_active ? "Desativar" : "Ativar"}
              </button>
              <button
                type="button"
                onClick={() => onRemove(p)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
