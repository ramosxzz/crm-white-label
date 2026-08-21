import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllLeads } from "@/lib/auth/roles";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

const FOLDERS = [
  { value: "primeiro_contato", label: "Primeiro contato" },
  { value: "reaplicacao", label: "Reaplicação" },
  { value: "mkt", label: "MKT" },
] as const;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Pastas NAO sao um filtro dentro de Leads - sao uma lista separada e leve.
 * Leads normais chegam pelo WhatsApp e vivem no funil/kanban; pastas sao
 * so o que foi roteado manualmente (Jeruza mandando urgencia, ou Michele
 * repassando pra vendedora), sem as metricas/paginacao pesadas da tela de
 * Leads que nao fazem sentido aqui.
 */
export default async function PastasPage({
  searchParams,
}: {
  searchParams?: Promise<{ folder?: string }>;
}) {
  const ctx = await requireContext();
  if (!ctx.tenant.lead_folders_enabled) redirect("/dashboard");

  const params = await searchParams;
  const folder = FOLDERS.some((f) => f.value === params?.folder) ? params!.folder! : "primeiro_contato";

  const supabase = await createClient();
  const canSeeAll = canSeeAllLeads(ctx.role);

  const [{ data: leads }, members] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, email, source, created_at, assigned_to")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_folder", folder)
      .order("created_at", { ascending: false })
      .limit(200),
    canSeeAll ? listTenantUserOptions(ctx.tenantId) : Promise.resolve([]),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const rows = leads ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Pastas"
        description={`${rows.length} lead${rows.length === 1 ? "" : "s"} nessa pasta`}
      />

      <div className="border-b border-border/70 px-8">
        <div className="flex gap-1">
          {FOLDERS.map((f) => (
            <Link
              key={f.value}
              href={`/pastas?folder=${f.value}`}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                folder === f.value
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="p-8">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
            Nenhum lead nessa pasta ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
            {rows.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.phone || "sem telefone"}
                      {lead.source ? ` · ${lead.source}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {canSeeAll && lead.assigned_to && <p>{nameById.get(lead.assigned_to) ?? "—"}</p>}
                    <p>{formatDateTime(lead.created_at)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
