import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllLeads } from "@/lib/auth/roles";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listSellersForFolders } from "./actions";
import { AssignLead } from "./assign-lead";

const FOLDERS = [
  { value: "primeiro_contato", label: "Primeiro contato" },
  { value: "reaplicacao", label: "Reaplicação" },
  { value: "mkt", label: "MKT" },
] as const;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Pastas NAO sao um filtro dentro de Leads - sao a fila do que a prospeccao
 * (Jeruza) cadastrou. O caminho normal: o lead cai aqui sem dono, a gerente
 * (Michele) distribui pra vendedora. Vendedora so ve o que ja e dela; a
 * gestao ve a fila inteira e quem esta com o que.
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
  const canDistribute = canSeeAllLeads(ctx.role);

  const [{ data: leads }, sellers] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, email, source, created_at, assigned_to")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_folder", folder)
      .order("created_at", { ascending: false })
      .limit(200),
    listSellersForFolders(),
  ]);

  const nameById = new Map(sellers.map((s) => [s.id, s.name]));
  const rows = leads ?? [];
  const queue = rows.filter((l) => !l.assigned_to);
  const assigned = rows.filter((l) => l.assigned_to);

  function renderRow(lead: (typeof rows)[number]) {
    return (
      <li key={lead.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 hover:underline">
          <p className="truncate font-medium">{lead.name}</p>
          <p className="text-xs text-muted-foreground">
            {lead.phone || "sem telefone"}
            {lead.source ? ` · ${lead.source}` : ""} · {formatDateTime(lead.created_at)}
          </p>
        </Link>
        <div className="shrink-0">
          {canDistribute ? (
            <AssignLead leadId={lead.id} currentSellerId={lead.assigned_to} sellers={sellers} />
          ) : (
            lead.assigned_to && (
              <span className="text-xs text-muted-foreground">{nameById.get(lead.assigned_to) ?? "—"}</span>
            )
          )}
        </div>
      </li>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operação"
        title="Pastas"
        description={
          canDistribute
            ? `${queue.length} na fila · ${assigned.length} já distribuído(s)`
            : `${rows.length} lead${rows.length === 1 ? "" : "s"} pra você`
        }
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

      <div className="space-y-6 p-8">
        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
            Nenhum lead nessa pasta ainda.
          </div>
        )}

        {canDistribute && queue.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold">Aguardando distribuição</h2>
              <Badge variant="warning">{queue.length}</Badge>
            </div>
            <ul className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
              {queue.map(renderRow)}
            </ul>
          </section>
        )}

        {(canDistribute ? assigned : rows).length > 0 && (
          <section>
            {canDistribute && <h2 className="mb-2 text-sm font-semibold">Já distribuídos</h2>}
            <ul className="divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
              {(canDistribute ? assigned : rows).map(renderRow)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
