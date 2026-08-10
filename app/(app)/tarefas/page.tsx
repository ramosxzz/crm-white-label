import { PageHeader } from "@/components/app/page-header";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { TasksView } from "./tasks-view";
import type { TaskRow } from "./actions";

export const dynamic = "force-dynamic";

export default async function TarefasPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; pessoa?: string }>;
}) {
  const ctx = await requireContext();
  const supabase = await createClient();
  const params = await searchParams;

  const status = ["abertas", "concluidas", "todas"].includes(params?.status ?? "")
    ? (params!.status as "abertas" | "concluidas" | "todas")
    : "abertas";
  // "todos" e explicito; sem parametro, cada um chega vendo o que e seu.
  const pessoa = params?.pessoa ?? ctx.userId;

  const users = await listTenantUserOptions(ctx.tenantId);

  let query = supabase
    .from("tasks")
    .select("id, title, notes, due_at, status, completed_at, created_at, assigned_to, created_by, lead_id")
    .eq("tenant_id", ctx.tenantId)
    .is("lead_id", null)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (status === "abertas") query = query.eq("status", "open");
  if (status === "concluidas") query = query.eq("status", "done");
  if (pessoa !== "todos") query = query.eq("assigned_to", pessoa);

  const { data: tasks } = await query;

  return (
    <div>
      <PageHeader
        eyebrow="Organização"
        title="Tarefas"
        description="Distribua o que precisa ser feito e acompanhe quem concluiu. Quem recebe é avisado no sino."
      />
      <div className="p-6">
        <TasksView
          tasks={(tasks ?? []) as TaskRow[]}
          users={users}
          currentUserId={ctx.userId}
          activeStatus={status}
          activePerson={pessoa}
        />
      </div>
    </div>
  );
}
