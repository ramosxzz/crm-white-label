"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Plus, RotateCcw, Trash2, CalendarClock, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBRTDateShort } from "@/lib/date/brt";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import { createTask, setTaskStatus, deleteTask, type TaskRow } from "./actions";
import type { TenantUserOption } from "@/lib/tenant/users";

const STATUS_TABS = [
  { value: "abertas", label: "Abertas" },
  { value: "concluidas", label: "Concluídas" },
  { value: "todas", label: "Todas" },
];

/** Vencida = prazo no passado e ainda aberta. */
function isOverdue(task: TaskRow) {
  return task.status === "open" && !!task.due_at && new Date(task.due_at) < new Date();
}

export function TasksView({
  tasks,
  users,
  currentUserId,
  activeStatus,
  activePerson,
}: {
  tasks: TaskRow[];
  users: TenantUserOption[];
  currentUserId: string;
  activeStatus: string;
  activePerson: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"task" | "meeting">("task");
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const isMeeting = kind === "meeting";

  const nameOf = (id: string | null) =>
    users.find((u) => u.id === id)?.name ?? "Sem responsável";

  function href(next: { status?: string; pessoa?: string }) {
    const qs = new URLSearchParams();
    qs.set("status", next.status ?? activeStatus);
    qs.set("pessoa", next.pessoa ?? activePerson);
    return `/tarefas?${qs.toString()}`;
  }

  function submit() {
    start(async () => {
      try {
        await createTask({ title, assignedTo, notes, dueAt, kind });
        setTitle("");
        setNotes("");
        setDueAt("");
        setKind("task");
        setOpen(false);
        notify({ title: isMeeting ? "Reunião marcada" : "Tarefa criada", tone: "success" });
      } catch (e) {
        notifyError(e, isMeeting ? "Não foi possível marcar a reunião." : "Não foi possível criar a tarefa.");
      }
    });
  }

  async function toggle(task: TaskRow) {
    setBusyId(task.id);
    try {
      await setTaskStatus(task.id, task.status === "done" ? "open" : "done");
    } catch (e) {
      notifyError(e, "Não foi possível atualizar.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(task: TaskRow) {
    const ok = await confirmDialog({
      title: "Excluir esta tarefa?",
      description: task.title,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(task.id);
    try {
      await deleteTask(task.id);
    } catch (e) {
      notifyError(e, "Não foi possível excluir.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={href({ status: tab.value })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                activeStatus === tab.value
                  ? "border-brand/40 bg-brand/15 text-brand"
                  : "border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href({ pessoa: currentUserId })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              activePerson === currentUserId
                ? "border-brand/40 bg-brand/15 text-brand"
                : "border-border/70 text-muted-foreground hover:bg-muted/40",
            )}
          >
            Minhas
          </Link>
          <Link
            href={href({ pessoa: "todos" })}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              activePerson === "todos"
                ? "border-brand/40 bg-brand/15 text-brand"
                : "border-border/70 text-muted-foreground hover:bg-muted/40",
            )}
          >
            Da equipe
          </Link>
          <Button type="button" variant="brand" size="sm" onClick={() => setOpen((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      {open && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="task-kind">Tipo</Label>
              <select
                id="task-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "task" | "meeting")}
                className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="task">Tarefa</option>
                <option value="meeting">Reunião interna / alinhamento</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_14rem_12rem]">
              <div className="space-y-1.5">
                <Label htmlFor="task-title">{isMeeting ? "Assunto da reunião" : "O que precisa ser feito"}</Label>
                <Input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isMeeting ? "Alinhamento semanal com o time" : "Subir os anúncios do cliente X"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-user">{isMeeting ? "Com quem" : "Responsável"}</Label>
                <select
                  id="task-user"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.id === currentUserId ? " (eu)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">{isMeeting ? "Data e hora" : "Prazo (opcional)"}</Label>
                <Input
                  id="task-due"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  required={isMeeting}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-notes">Detalhes (opcional)</Label>
              <Textarea
                id="task-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isMeeting ? "Pauta, links da chamada..." : "Contexto, links, o que considerar concluído..."}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="brand"
                onClick={submit}
                disabled={pending || !title.trim() || (isMeeting && !dueAt)}
              >
                {isMeeting ? "Marcar reunião" : "Criar tarefa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          Nenhuma tarefa aqui.
        </div>
      ) : (
        <div className="divide-y divide-border/70 rounded-xl border border-border/70">
          {tasks.map((task) => {
            const done = task.status === "done";
            const overdue = isOverdue(task);
            return (
              <div key={task.id} className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  onClick={() => void toggle(task)}
                  disabled={busyId === task.id}
                  aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors",
                    done
                      ? "border-success bg-success text-success-foreground"
                      : "border-border hover:border-brand",
                  )}
                >
                  {done && <Check className="h-3.5 w-3.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={cn("flex items-center gap-1.5 text-sm font-medium", done && "text-muted-foreground line-through")}>
                    {task.kind === "meeting" && <Users className="h-3.5 w-3.5 shrink-0 text-brand" />}
                    {task.title}
                  </p>
                  {task.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{task.notes}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <UserRound className="h-3 w-3" />
                      {nameOf(task.assigned_to)}
                    </span>
                    {task.due_at && (
                      <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")}>
                        <CalendarClock className="h-3 w-3" />
                        {formatBRTDateShort(task.due_at)}
                      </span>
                    )}
                  </div>
                </div>

                {overdue && <Badge variant="destructive">Atrasada</Badge>}
                {done && <Badge variant="success">Concluída</Badge>}

                <div className="flex shrink-0 gap-1">
                  {done && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Reabrir"
                      onClick={() => void toggle(task)}
                      disabled={busyId === task.id}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    aria-label="Excluir"
                    onClick={() => void remove(task)}
                    disabled={busyId === task.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
