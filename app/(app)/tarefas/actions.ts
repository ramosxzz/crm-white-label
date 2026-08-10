"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { notifyUser } from "@/lib/notifications/notify";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  status: "open" | "done" | "cancelled";
  completed_at: string | null;
  created_at: string;
  assigned_to: string | null;
  created_by: string | null;
  lead_id: string | null;
};

export async function createTask(input: {
  title: string;
  assignedTo: string;
  notes?: string;
  dueAt?: string;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();

  const title = input.title.trim();
  if (!title) throw new Error("Informe o que precisa ser feito.");
  if (!input.assignedTo) throw new Error("Escolha quem vai executar.");

  const dueAt = input.dueAt ? new Date(input.dueAt).toISOString() : null;

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: ctx.tenantId,
      lead_id: null,
      assigned_to: input.assignedTo,
      created_by: ctx.userId,
      title,
      notes: input.notes?.trim() || null,
      due_at: dueAt,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Quem se atribui uma tarefa nao precisa ser avisado de si mesmo.
  if (input.assignedTo !== ctx.userId) {
    await notifyUser(supabase, {
      tenantId: ctx.tenantId,
      userId: input.assignedTo,
      kind: "task_assigned",
      title: "Nova tarefa para você",
      description: title,
      link: "/tarefas",
    });
  }

  revalidatePath("/tarefas");
  return created as { id: string } | null;
}

export async function setTaskStatus(taskId: string, status: "open" | "done" | "cancelled") {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("title, created_by, assigned_to")
    .eq("id", taskId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!task) throw new Error("Tarefa nao encontrada.");

  const { error } = await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  // Avisa quem pediu, e so quando a tarefa fecha: quem delega precisa saber
  // que terminou sem ter que ficar conferindo a lista.
  const row = task as { title: string; created_by: string | null; assigned_to: string | null };
  if (status === "done" && row.created_by && row.created_by !== ctx.userId) {
    await notifyUser(supabase, {
      tenantId: ctx.tenantId,
      userId: row.created_by,
      kind: "task_done",
      title: "Tarefa concluída",
      description: row.title,
      link: "/tarefas",
    });
  }

  revalidatePath("/tarefas");
}

export async function deleteTask(taskId: string) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  revalidatePath("/tarefas");
}
