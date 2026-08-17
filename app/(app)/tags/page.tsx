import Link from "next/link";
import { Tag, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { listTagsWithLeadCount } from "../leads/actions";
import { CreateTagForm } from "./create-tag-form";

export default async function TagsPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const tags = await listTagsWithLeadCount();
  const leadIds = [...new Set(tags.flatMap((tag) => tag.leadIds))];

  const { data: taggedLeads } = leadIds.length
    ? await supabase
        .from("leads")
        .select("id, name, phone")
        .eq("tenant_id", ctx.tenantId)
        .in("id", leadIds)
    : { data: [] };

  const leadsById = new Map((taggedLeads ?? []).map((lead) => [lead.id, lead]));
  const assignedCount = tags.reduce((total, tag) => total + tag.count, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Organização"
        title="Tags"
        description="Consulte as tags cadastradas, veja onde estão sendo usadas e filtre os respectivos leads."
        actions={
          <Button asChild variant="outline">
            <Link href="/leads">Abrir leads</Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <CreateTagForm />

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{tags.length}</p>
                <p className="text-xs text-muted-foreground">tags cadastradas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{assignedCount}</p>
                <p className="text-xs text-muted-foreground">vínculos entre tags e leads</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {tags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <Tag className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nenhuma tag cadastrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre a primeira tag no campo acima.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {tags.map((item) => {
              const leads = item.leadIds
                .map((id) => leadsById.get(id))
                .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));

              return (
                <Card key={item.tag}>
                  <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/60 pb-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Tag className="h-4 w-4 shrink-0 text-brand" />
                      <CardTitle className="truncate text-base">{item.tag}</CardTitle>
                    </div>
                    <Badge variant={item.count > 0 ? "secondary" : "outline"} className="shrink-0 tabular-nums">
                      {item.count} {item.count === 1 ? "lead" : "leads"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {leads.length > 0 ? (
                      <div className="space-y-1">
                        {leads.slice(0, 8).map((lead) => (
                          <Link
                            key={lead.id}
                            href={`/leads/${lead.id}`}
                            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/60"
                          >
                            <span className="truncate font-medium">{lead.name || lead.phone || "Lead sem nome"}</span>
                            {lead.phone ? <span className="shrink-0 text-xs text-muted-foreground">{lead.phone}</span> : null}
                          </Link>
                        ))}
                        {leads.length > 8 ? (
                          <p className="px-3 pt-1 text-xs text-muted-foreground">Mais {leads.length - 8} leads vinculados.</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">Essa tag ainda não foi aplicada a nenhum lead.</p>
                    )}

                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link href={{ pathname: "/leads", query: { tag: item.tag } }}>
                        Ver leads com esta tag
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
