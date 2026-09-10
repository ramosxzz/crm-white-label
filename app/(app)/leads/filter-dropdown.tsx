"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; color?: string | null; count?: number };

/**
 * Dropdown de filtro generico (etapa, responsavel, origem, tags, periodo).
 * Substitui a fileira de botoes/chips sempre visiveis e a segunda sidebar de
 * tags - o botao mostra o rotulo + quantos estao selecionados, o resto fica
 * escondido ate abrir.
 */
export function FilterDropdown({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  multi = true,
  align = "start",
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  multi?: boolean;
  align?: "start" | "end";
}) {
  const hasSelection = selected.length > 0;

  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            hasSelection
              ? "border-brand/50 bg-brand/10 text-brand"
              : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {hasSelection && (
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          sideOffset={6}
          className="z-50 max-h-80 w-64 overflow-y-auto rounded-lg border border-border/70 bg-popover p-1 text-popover-foreground shadow-elev-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          {options.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">Nada disponível.</p>
          )}
          {options.map((option) => {
            const active = selected.includes(option.value);
            return (
              <DropdownMenuPrimitive.Item
                key={option.value}
                onSelect={(e) => {
                  if (multi) e.preventDefault();
                  onToggle(option.value);
                }}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
              >
                <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", multi ? "" : "rounded-full", active ? "border-brand bg-brand text-brand-foreground" : "border-border")}>
                  {active && <Check className="h-3 w-3" />}
                </span>
                {option.color && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{option.count}</span>
                )}
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
