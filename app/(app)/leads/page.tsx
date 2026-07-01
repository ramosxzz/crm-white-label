import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Badge } from "@/components/ui/badge";
import { formatPhoneBR, formatCurrencyBRL } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { NewLeadDialog } from "./new-lead-dialog";
import { ImportCsvDialog } from "./import-csv-dialog";

export default async function LeadsPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const [{ data: leads }, { data: stages }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, phone, email, source, value_cents, created_at, stage_id")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("pipeline_stages")
      .select("id, name, color")
      .eq("tenant_id", ctx.tenantId)
      .order("position"),
  ]);

  const stageMap = new Map((stages ?? []).map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader
        eyebrow="Operacao"
        title="Leads"
        description={`${leads?.length ?? 0} leads cadastrados`}
        actions={
          <>
            <ImportCsvDialog />
            <NewLeadDialog stages={stages ?? []} />
          </>
        }
      />

      <div className="p-8">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-elev-1">
          <table className="w-full text-sm">
            <thead className="border-b border-border/70 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Estagio</th>
                <th className="px-5 py-3 font-medium">Origem</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {(leads ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <p className="font-medium">Nenhum lead ainda</p>
                    <p className="mt-1 text-sm text-muted-foreground">Crie um lead manualmente ou importe uma planilha CSV.</p>
                  </td>
                </tr>
              )}
              {leads?.map((l) => {
                const stage = stageMap.get(l.stage_id ?? "");
                return (
                  <tr key={l.id} className="group transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${l.id}`} className="font-medium transition-colors hover:text-brand">
                        {l.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{formatPhoneBR(l.phone)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.email ?? "-"}</td>
                    <td className="px-5 py-3">
                      {stage ? (
                        <Badge
                          variant="outline"
                          className="font-medium"
                          style={{ borderColor: `${stage.color}55`, color: stage.color ?? undefined }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stage.color ?? undefined }} />
                          {stage.name}
                        </Badge>
                      ) : "-"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{l.source ?? "-"}</td>
                    <td className="px-5 py-3 text-right font-medium">{formatCurrencyBRL(l.value_cents)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/leads/${l.id}`} className="opacity-0 transition-opacity group-hover:opacity-100">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
