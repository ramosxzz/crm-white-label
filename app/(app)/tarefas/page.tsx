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
    .select("id, title, notes, due_at, status, completed_at, created_at, assigned_to, created_by, lead_id, kind")
    .eq("tenant_id", ctx.tenantId)
    // Tarefa criada no perfil do lead (lead_id preenchido) tambem conta
    // aqui - antes esse filtro deixava ela invisivel nessa aba, so dava
    // pra ver de novo abrindo o lead.
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (status === "abertas") query = query.eq("status", "open");
  if (status === "concluidas") query = query.eq("status", "done");
  if (pessoa !== "todos") query = query.eq("assigned_to", pessoa);

  const { data: tasks } = await query;

  const leadIds = Array.from(new Set((tasks ?? []).map((t) => t.lead_id).filter((id): id is string => Boolean(id))));
  const { data: leadRows } = leadIds.length
    ? await supabase.from("leads").select("id, name").in("id", leadIds).eq("tenant_id", ctx.tenantId)
    : { data: [] as { id: string; name: string }[] };
  const leadNames = Object.fromEntries((leadRows ?? []).map((l) => [l.id, l.name]));

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
          leadNames={leadNames}
        />
      </div>
    </div>
  );
}
