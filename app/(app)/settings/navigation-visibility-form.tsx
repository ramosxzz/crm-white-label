"use client";

import { notify, notifyError } from "@/lib/ui/feedback";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TENANT_NAVIGATION_ITEMS, type TenantNavigationItemId } from "@/lib/navigation/tenant-navigation";
import { updateHiddenNavigationItems } from "./actions";

const GROUP_ORDER = ["Visão geral", "CRM", "Produtividade", "Comunicação", "Gestão", "Configurações"] as const;

export function NavigationVisibilityForm({ hiddenItems }: { hiddenItems: string[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<TenantNavigationItemId>>(
    () => new Set(hiddenItems as TenantNavigationItemId[]),
  );
  const [pending, start] = useTransition();

  function toggle(id: TenantNavigationItemId) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    start(async () => {
      try {
        await updateHiddenNavigationItems([...hidden]);
        router.refresh();
        notify({ title: "Menu lateral atualizado", tone: "success" });
      } catch (err) {
        notifyError(err);
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Desmarque um módulo pra sumir do menu lateral e bloquear o acesso direto pela URL.
        Útil pra esconder o que este tenant não usa e deixar o menu mais limpo.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {GROUP_ORDER.map((group) => {
          const items = TENANT_NAVIGATION_ITEMS.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const checked = !hidden.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border accent-brand"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                      />
                      <span className={cn(!checked && "text-muted-foreground line-through")}>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar menu lateral
      </button>
    </div>
  );
}
