import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { listSellers, searchPartners } from "./actions";
import { ProspeccaoForm } from "./prospeccao-form";

export default async function ProspeccaoPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.lead_folders_enabled) redirect("/dashboard");

  const supabase = await createClient();
  const [sellers, partners, { data: recentLeads }] = await Promise.all([
    listSellers(),
    searchPartners(""),
    supabase
      .from("leads")
      .select("id, name, phone, lead_folder, assigned_to, created_at")
      .eq("tenant_id", ctx.tenantId)
      .not("lead_folder", "is", null)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const sellerNameById = new Map(sellers.map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold">Prospecção</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre o lead e mande direto pra pasta de quem vai atender.
        </p>
      </div>

      <ProspeccaoForm sellers={sellers} initialPartners={partners} />

      {recentLeads && recentLeads.length > 0 && (
        <section className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Enviados recentemente</h2>
          <ul className="divide-y divide-border/70">
            {recentLeads.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.phone || "sem telefone"}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{sellerNameById.get(lead.assigned_to ?? "") ?? "—"}</p>
                  <p>
                    {lead.lead_folder === "primeiro_contato"
                      ? "Primeiro contato"
                      : lead.lead_folder === "reaplicacao"
                        ? "Reaplicação"
                        : "MKT"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
