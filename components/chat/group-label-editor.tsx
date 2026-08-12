"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, X, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addGroupLabel, removeGroupLabel, listGroupLabels } from "@/app/(app)/chat/actions";
import { notifyError } from "@/lib/ui/feedback";

type GroupLabel = { id: string; name: string; color: string };

/** Categorias do grupo: mostra as atuais (removiveis) e um "+" pra atribuir
 * uma existente ou criar uma nova - addGroupLabel ja faz find-or-create por
 * nome, entao digitar algo novo "cria a categoria" na hora. */
export function GroupLabelEditor({
  groupId,
  labels,
  onLabelsChange,
  allLabels,
}: {
  groupId: string;
  labels: GroupLabel[];
  onLabelsChange: (next: GroupLabel[]) => void;
  allLabels: GroupLabel[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const assignedIds = useMemo(() => new Set(labels.map((l) => l.id)), [labels]);
  const suggestions = useMemo(() => {
    const term = draft.trim().toLowerCase();
    return allLabels
      .filter((label) => !assignedIds.has(label.id))
      .filter((label) => !term || label.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [allLabels, assignedIds, draft]);
  const exactMatch = allLabels.some((label) => label.name.toLowerCase() === draft.trim().toLowerCase());

  function assign(name: string) {
    const value = name.trim();
    if (!value) return;
    start(async () => {
      try {
        const label = await addGroupLabel({ groupId, name: value });
        if (label) onLabelsChange([...labels.filter((l) => l.id !== label.id), label]);
        setDraft("");
        setOpen(false);
      } catch (err) {
        notifyError(err, "Nao foi possivel adicionar a categoria.");
      }
    });
  }

  function remove(labelId: string) {
    setBusyId(labelId);
    void removeGroupLabel({ groupId, labelId })
      .then(() => onLabelsChange(labels.filter((l) => l.id !== labelId)))
      .catch((err) => notifyError(err, "Nao foi possivel remover a categoria."))
      .finally(() => setBusyId(null));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className="gap-1 px-2 py-0 text-[10px]"
          style={{ borderColor: `${label.color}55`, color: label.color }}
        >
          {label.name}
          <button
            type="button"
            onClick={() => remove(label.id)}
            disabled={busyId === label.id}
            className="rounded-full hover:opacity-70"
            title="Remover categoria"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground" title="Adicionar categoria">
            <Plus className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="p-2">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Buscar ou criar categoria..."
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  assign(draft);
                }
              }}
              disabled={pending}
            />
          </div>
          {suggestions.map((label) => (
            <DropdownMenuItem key={label.id} onSelect={() => assign(label.name)} className="cursor-pointer gap-2">
              <Tag className="h-3.5 w-3.5" style={{ color: label.color }} />
              {label.name}
            </DropdownMenuItem>
          ))}
          {draft.trim() && !exactMatch && (
            <DropdownMenuItem onSelect={() => assign(draft)} className="cursor-pointer gap-2 text-brand">
              <Plus className="h-3.5 w-3.5" /> Criar categoria "{draft.trim()}"
            </DropdownMenuItem>
          )}
          {suggestions.length === 0 && !draft.trim() && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Digite pra criar a primeira categoria.</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
