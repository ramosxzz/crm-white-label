"use client";

import { useState, useTransition } from "react";
import { ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify, notifyError } from "@/lib/ui/feedback";
import type {
  ServiceCatalogCategory,
  ServiceCatalogItem,
} from "@/lib/supabase/database.types";
import {
  createServiceCatalogItem,
  updateServiceCatalogItems,
} from "./actions";

const CATEGORY_LABEL: Record<ServiceCatalogCategory, string> = {
  lavagem: "Lavagem",
  impermeabilizacao: "Impermeabilização",
  couro: "Couro",
  outro: "Outro",
};

export function ServiceCatalogPanel({ items }: { items: ServiceCatalogItem[] }) {
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(items.map((item) => [item.id, (item.price_cents / 100).toFixed(2)])),
  );
  const [active, setActive] = useState(() =>
    Object.fromEntries(items.map((item) => [item.id, item.is_active])),
  );
  const [form, setForm] = useState({
    category: "lavagem" as ServiceCatalogCategory,
    name: "",
    unit: "un",
    price: "0",
  });
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateServiceCatalogItems(
          items.map((item) => ({
            id: item.id,
            price: Number(prices[item.id] ?? 0),
            is_active: Boolean(active[item.id]),
          })),
        );
        notify({ title: "Tabela de preços salva", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível salvar a tabela");
      }
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      try {
        await createServiceCatalogItem({
          category: form.category,
          name: form.name,
          unit: form.unit,
          price: Number(form.price),
        });
        setForm({ category: "lavagem", name: "", unit: "un", price: "0" });
        notify({ title: "Serviço adicionado à tabela", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível adicionar o serviço");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-elev-1">
      <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
        <ListPlus className="h-4 w-4 text-brand" /> Catálogo e tabela de preços
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Valores oficiais de lavagem, impermeabilização e couro. Ao selecionar um item na OS, a
        descrição e o preço de tabela são preenchidos automaticamente.
      </p>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_7rem_8rem] items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
          >
            <label className="inline-flex min-w-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(active[item.id])}
                onChange={(event) =>
                  setActive((current) => ({ ...current, [item.id]: event.target.checked }))
                }
              />
              <span className="truncate">
                {item.name}{" "}
                <span className="text-xs text-muted-foreground">
                  · {CATEGORY_LABEL[item.category]} / {item.unit}
                </span>
              </span>
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={prices[item.id] ?? "0"}
              onChange={(event) =>
                setPrices((current) => ({ ...current, [item.id]: event.target.value }))
              }
            />
            <span className="text-xs text-muted-foreground">Preço (R$)</span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-lg bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
            Cadastre o primeiro serviço abaixo.
          </p>
        )}
      </div>
      {items.length > 0 && (
        <Button type="button" variant="brand" className="mt-4" disabled={pending} onClick={save}>
          Salvar tabela
        </Button>
      )}

      <form
        onSubmit={add}
        className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[9rem_1fr_6rem_8rem_auto]"
      >
        <div className="space-y-1.5">
          <Label htmlFor="catalog-category">Categoria</Label>
          <select
            id="catalog-category"
            value={form.category}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                category: event.target.value as ServiceCatalogCategory,
              }))
            }
            className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
          >
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-name">Peça / serviço</Label>
          <Input
            id="catalog-name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Ex.: Sofá 3 lugares"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-unit">Unidade</Label>
          <Input
            id="catalog-unit"
            value={form.unit}
            onChange={(event) =>
              setForm((current) => ({ ...current, unit: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="catalog-price">Preço (R$)</Label>
          <Input
            id="catalog-price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) =>
              setForm((current) => ({ ...current, price: event.target.value }))
            }
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pending} aria-label="Adicionar serviço">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </section>
  );
}
