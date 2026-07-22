"use client";

import { useState, useTransition } from "react";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { addLeadNote } from "./actions";

type ActivityRow = {
  id: string;
  kind: string;
  payload: unknown;
  user_id: string | null;
  created_at: string;
};

export function NotesPanel({
  leadId,
  activities,
  authorNames,
}: {
  leadId: string;
  activities: ActivityRow[];
  authorNames: Record<string, string>;
}) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const notes = activities
    .filter((a) => a.kind === "note")
    .map((a) => ({
      id: a.id,
      text: ((a.payload as { text?: string } | null)?.text ?? "").trim(),
      createdAt: a.created_at,
      author: (a.user_id && authorNames[a.user_id]) || "Equipe",
    }));

  function submit() {
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        await addLeadNote({ leadId, text: value });
        setText("");
      } catch (err) {
        alert((err as Error).message || "Nao foi possivel salvar a nota.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-brand" /> Notas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-border/60 pt-4">
        <div className="space-y-2">
          <Textarea
            rows={3}
            placeholder="Escreva uma nota sobre este lead..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button size="sm" onClick={submit} disabled={isPending || !text.trim()}>
            {isPending ? "Salvando..." : "Adicionar nota"}
          </Button>
        </div>
        <div className="space-y-3">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="whitespace-pre-wrap text-sm">{n.text}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {n.author} · {new Date(n.createdAt).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
