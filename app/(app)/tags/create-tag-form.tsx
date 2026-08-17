"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Tag } from "lucide-react";
import { createLeadTag } from "../leads/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/ui/feedback";

export function CreateTagForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!value || pending) return;

    startTransition(async () => {
      const result = await createLeadTag(value);
      if (!result.ok) {
        notify({ title: result.error, tone: "error" });
        return;
      }

      setName("");
      notify({ title: `Tag “${result.tag}” cadastrada`, tone: "success" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="new-tag-name" className="flex items-center gap-2 text-sm font-semibold">
          <Tag className="h-4 w-4 text-brand" />
          Cadastrar nova tag
        </label>
        <Input
          id="new-tag-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: HIG, Imper, Reaplicação"
          maxLength={40}
          disabled={pending}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Depois de cadastrada, ela aparecerá para seleção em todos os leads e conversas.</p>
      </div>
      <Button type="submit" variant="brand" disabled={pending || !name.trim()} className="shrink-0">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Cadastrar tag
      </Button>
    </form>
  );
}
