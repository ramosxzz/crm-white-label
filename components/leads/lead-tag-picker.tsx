"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LeadTagPickerProps = {
  value: string[];
  options: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  className?: string;
};

export function LeadTagPicker({ value, options, onChange, disabled = false, className }: LeadTagPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const selectedKeys = useMemo(() => new Set(value.map((tag) => tag.toLocaleLowerCase("pt-BR"))), [value]);
  const catalog = useMemo(() => {
    const unique = new Map<string, string>();
    for (const tag of [...options, ...value]) {
      const name = tag.trim();
      if (!name || name.startsWith("__close_channel:")) continue;
      const key = name.toLocaleLowerCase("pt-BR");
      if (!unique.has(key)) unique.set(key, name);
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [options, value]);

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const suggestions = catalog.filter((tag) => {
    const key = tag.toLocaleLowerCase("pt-BR");
    return !selectedKeys.has(key) && (!normalizedQuery || key.includes(normalizedQuery));
  });
  const exactCatalogMatch = catalog.find((tag) => tag.toLocaleLowerCase("pt-BR") === normalizedQuery);
  const canCreate = Boolean(normalizedQuery && !exactCatalogMatch && !selectedKeys.has(normalizedQuery) && value.length < 20);

  function add(tag: string) {
    const name = tag.trim().slice(0, 40);
    if (!name || value.length >= 20 || selectedKeys.has(name.toLocaleLowerCase("pt-BR"))) return;
    onChange([...value, name]);
    setQuery("");
    setOpen(false);
  }

  function submitQuery() {
    if (exactCatalogMatch) add(exactCatalogMatch);
    else if (canCreate) add(query);
    else if (suggestions[0]) add(suggestions[0]);
  }

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      <div className="flex min-h-6 flex-wrap gap-1.5">
        {value.length ? (
          value
            .filter((tag) => !tag.startsWith("__close_channel:"))
            .map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-brand/10 py-1 pl-2 pr-1 text-[11px] font-medium text-brand"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((current) => current !== tag))}
                  disabled={disabled}
                  className="grid h-4 w-4 place-items-center rounded-sm text-brand/70 transition hover:bg-brand/20 hover:text-brand disabled:opacity-50"
                  aria-label={`Remover tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
        ) : (
          <span className="text-xs text-muted-foreground">Nenhuma tag ainda.</span>
        )}
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitQuery();
                }
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Buscar tag cadastrada..."
              className="h-8 bg-background/70 pl-8 text-sm"
              disabled={disabled || value.length >= 20}
              role="combobox"
              aria-expanded={open}
              aria-label="Buscar ou criar tag"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={submitQuery}
            disabled={disabled || (!query.trim() && !suggestions[0]) || value.length >= 20}
            aria-label="Adicionar tag"
          >
            {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {open && !disabled ? (
          <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tags cadastradas
            </p>
            {suggestions.length ? (
              suggestions.slice(0, 50).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => add(tag)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{tag}</span>
                  <Check className="h-3.5 w-3.5 text-muted-foreground/60" />
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {catalog.length ? "Nenhuma tag encontrada." : "Ainda não há tags cadastradas."}
              </p>
            )}
            {canCreate ? (
              <button
                type="button"
                onClick={() => add(query)}
                className="mt-1 flex w-full items-center gap-2 border-t border-border px-2 py-2 text-left text-sm font-medium text-brand hover:bg-brand/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Criar “{query.trim().slice(0, 40)}”
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="text-[10px] text-muted-foreground">Selecione uma existente ou digite para criar uma nova.</p>
    </div>
  );
}
