"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { notifyError } from "@/lib/ui/feedback";
import { cn } from "@/lib/utils";
import {
  TENANT_NAVIGATION_ITEMS,
  announceTenantNavigationUpdate,
  normalizeHiddenNavigationItems,
  type TenantNavigationItemId,
} from "@/lib/navigation/tenant-navigation";
import { updateHiddenNavigationItems } from "./actions";

const GROUP_ORDER = ["Visão geral", "CRM", "Produtividade", "Comunicação", "Gestão", "Configurações"] as const;

type SaveState = "idle" | "saving" | "saved";

export function NavigationVisibilityForm({ hiddenItems }: { hiddenItems: string[] }) {
  const router = useRouter();
  const initialHidden = normalizeHiddenNavigationItems(hiddenItems);
  const [hidden, setHidden] = useState<Set<TenantNavigationItemId>>(() => new Set(initialHidden));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const hiddenRef = useRef(new Set<TenantNavigationItemId>(initialHidden));
  const lastSavedRef = useRef(new Set<TenantNavigationItemId>(initialHidden));
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const requestRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  function applyAndSave(next: Set<TenantNavigationItemId>) {
    const values = [...next];
    const request = ++requestRef.current;
    hiddenRef.current = next;
    setHidden(new Set(next));
    setSaveState("saving");
    announceTenantNavigationUpdate(values);

    const operation = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        const saved = await updateHiddenNavigationItems(values);
        const normalized = new Set(normalizeHiddenNavigationItems(saved));
        lastSavedRef.current = normalized;
        if (request !== requestRef.current) return;
        hiddenRef.current = normalized;
        setHidden(new Set(normalized));
        announceTenantNavigationUpdate([...normalized]);
        setSaveState("saved");
        router.refresh();
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1800);
      });

    queueRef.current = operation.then(() => undefined, () => undefined);
    operation.catch((error) => {
      if (request !== requestRef.current) return;
      const rollback = new Set(lastSavedRef.current);
      hiddenRef.current = rollback;
      setHidden(rollback);
      setSaveState("idle");
      announceTenantNavigationUpdate([...rollback]);
      notifyError(error, "Não foi possível atualizar o menu");
    });
  }

  function toggleItem(id: TenantNavigationItemId) {
    const next = new Set(hiddenRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applyAndSave(next);
  }

  function toggleGroup(itemIds: TenantNavigationItemId[]) {
    const next = new Set(hiddenRef.current);
    const allVisible = itemIds.every((id) => !next.has(id));
    for (const id of itemIds) {
      if (allVisible) next.add(id);
      else next.delete(id);
    }
    applyAndSave(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Escolha somente o que a equipe usa. As alterações são salvas automaticamente e aparecem no menu na mesma hora.
        </p>
        <div className="flex h-8 shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground" aria-live="polite">
          {saveState === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando</>}
          {saveState === "saved" && <><Check className="h-3.5 w-3.5 text-emerald-500" /> Salvo</>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {GROUP_ORDER.map((group) => {
          const items = TENANT_NAVIGATION_ITEMS.filter((item) => item.group === group);
          if (items.length === 0) return null;
          const ids = items.map((item) => item.id);
          const visibleCount = ids.filter((id) => !hidden.has(id)).length;
          const sectionVisible = visibleCount > 0;

          return (
            <section key={group} className="overflow-hidden rounded-xl border border-border/70 bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold">{group}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {visibleCount} de {items.length} {items.length === 1 ? "item visível" : "itens visíveis"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGroup(ids)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  {sectionVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {sectionVisible ? "Ocultar seção" : "Mostrar seção"}
                </button>
              </div>

              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {items.map((item) => {
                  const enabled = !hidden.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => toggleItem(item.id)}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
                        enabled
                          ? "border-brand/30 bg-brand/5 text-foreground hover:bg-brand/10"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                          enabled ? "bg-brand" : "bg-muted-foreground/30",
                        )}
                      >
                        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", enabled ? "translate-x-[1.125rem]" : "translate-x-0.5")} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
