"use client";

import { useState, useTransition } from "react";
import { Check, Clock3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { completeLeadTask, createLeadTask } from "./actions";
import { formatBRTFullDateTime } from "@/lib/date/brt";

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  status: string;
  assigned_to: string | null;
};

export function TaskPanel({ leadId, tasks, currentUserId }: { leadId: string; tasks: TaskRow[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ordered = [...tasks].sort((a, b) => Number(a.status !== "open") - Number(b.status !== "open"));

  function create(formData: FormData) {
    startTransition(async () => {
      await createLeadTask({
        leadId,
        title: String(formData.get("title") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        dueAt: String(formData.get("due_at") ?? "") || undefined,
      });
      setOpen(false);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Tarefas</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="mr-2 h-3.5 w-3.5" />Nova tarefa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
            <form action={create} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="task-title">Titulo</Label><Input id="task-title" name="title" required /></div>
              <div className="space-y-1.5"><Label htmlFor="task-due">Prazo</Label><Input id="task-due" name="due_at" type="datetime-local" /></div>
              <div className="space-y-1.5"><Label htmlFor="task-notes">Notas</Label><Textarea id="task-notes" name="notes" /></div>
              <DialogFooter><Button disabled={isPending}>{isPending ? "Criando..." : "Criar tarefa"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3 border-t border-border/60 pt-4">
        {ordered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente.</p>}
        {ordered.map((task) => {
          const overdue = task.status === "open" && task.due_at && new Date(task.due_at) < new Date();
          return (
            <div key={task.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={task.status === "done" ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>{task.title}</p>
                  {overdue && <Badge variant="destructive">Atrasada</Badge>}
                </div>
                {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3 w-3" />
                  {task.due_at ? formatBRTFullDateTime(task.due_at) : "Sem prazo"}
                  {" · "}{task.assigned_to === currentUserId ? "Voce" : "Equipe"}
                </p>
              </div>
              {task.status === "open" && (
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Concluir tarefa" onClick={() => startTransition(() => completeLeadTask(task.id, leadId))}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
