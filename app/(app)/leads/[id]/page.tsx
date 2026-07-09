import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Mail, Phone, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatPhoneBR, initials } from "@/lib/utils";
import { LeadStageSelect } from "./lead-stage-select";
import { LeadFilesPanel } from "./lead-files-panel";
import { LeadDeleteButton } from "@/components/leads/lead-delete-button";
import { ScheduleMeetingButton } from "@/components/leads/schedule-meeting-button";
import { CallButton } from "@/components/leads/call-button";
import { TechnicalProfilePanel } from "./technical-profile-panel";
import { TaskPanel } from "./task-panel";
import { NotesPanel } from "./notes-panel";
import { ValuePanel } from "./value-panel";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!lead) notFound();

  const [{ data: stages }, { data: files }, { data: activities }, { data: technicalDefinitions }, { data: tasks }, { data: professionals }, { data: services }, { data: valueItems }, users] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, color")
      .eq("tenant_id", ctx.tenantId)
      .order("position"),
    supabase
      .from("files")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("custom_field_definitions")
      .select("id, key, label, field_type, options, is_required")
      .eq("tenant_id", ctx.tenantId)
      .eq("entity_type", "lead")
      .order("sort_order"),
    supabase
      .from("tasks")
      .select("id, title, notes, due_at, status, assigned_to")
      .eq("lead_id", lead.id)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("professionals")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("lead_value_items")
      .select("id, label, amount_cents, created_at")
      .eq("lead_id", lead.id)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: true }),
    listTenantUserOptions(ctx.tenantId),
  ]);

  const authorIds = Array.from(
    new Set((activities ?? []).map((a) => a.user_id).filter((v): v is string => Boolean(v))),
  );
  const { data: profiles } = authorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const authorNames = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name ?? "Equipe"]),
  ) as Record<string, string>;

  return (
    <div>
      <header className="border-b border-border/50 px-8 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/leads"><ArrowLeft className="h-4 w-4" /> Voltar para leads</Link>
        </Button>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-brand/20">
              <AvatarFallback className="bg-brand/15 font-display text-lg font-semibold text-brand">
                {initials(lead.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">{lead.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {lead.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="font-mono">{formatPhoneBR(lead.phone)}</span>
                  </span>
                )}
                {lead.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Criado em {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <ScheduleMeetingButton
              leadId={lead.id}
              leadName={lead.name}
              professionals={professionals ?? []}
              users={users}
              services={(services ?? []) as { id: string; name: string; duration_minutes: number }[]}
            />
            {lead.phone && <CallButton leadId={lead.id} phone={lead.phone} />}
            {lead.phone && (
              <Button asChild variant="brand">
                <Link href={`/chat/${lead.id}`} prefetch>
                  <MessageCircle className="h-4 w-4" /> Abrir conversa
                </Link>
              </Button>
            )}
            <LeadDeleteButton leadId={lead.id} leadName={lead.name} />
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informacoes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
              <Info label="Estagio">
                <LeadStageSelect leadId={lead.id} stageId={lead.stage_id} stages={stages ?? []} />
              </Info>
              <Info label="Valor">
                <ValuePanel leadId={lead.id} items={valueItems ?? []} totalCents={lead.value_cents ?? 0} />
              </Info>
              <Info label="Origem">{lead.source ?? "-"}</Info>
              <Info label="Atualizado">{new Date(lead.updated_at).toLocaleString("pt-BR")}</Info>
              <Info label="Tags" full>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags?.length
                    ? lead.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)
                    : <span className="text-muted-foreground">Sem tags</span>}
                </div>
              </Info>
              <Info label="Observacoes" full>
                <p className="whitespace-pre-wrap text-muted-foreground">{lead.notes ?? "Sem observacoes."}</p>
              </Info>
            </CardContent>
          </Card>

          <TechnicalProfilePanel
            leadId={lead.id}
            definitions={technicalDefinitions ?? []}
            initialValues={(lead.custom_fields ?? {}) as Record<string, unknown>}
          />

          <LeadFilesPanel leadId={lead.id} files={files ?? []} />
          <TaskPanel leadId={lead.id} tasks={tasks ?? []} currentUserId={ctx.userId} />
          <NotesPanel leadId={lead.id} activities={activities ?? []} authorNames={authorNames} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {(activities ?? []).length === 0 && (
              <p className="text-muted-foreground">Sem atividades ainda.</p>
            )}
            {activities?.map((a) => (
              <div key={a.id} className="relative pl-6">
                <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-brand ring-4 ring-brand/15" />
                <p className="font-medium">{describeActivity(a)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function describeActivity(activity: { kind: string; payload: unknown }): string {
  const payload = (activity.payload ?? {}) as Record<string, unknown>;
  switch (activity.kind) {
    case "note":
      return `Nota: "${String(payload.text ?? "")}"`;
    case "automation":
      return `Automação: ${String(payload.message ?? payload.ai ?? "executada")}`;
    case "technical_profile_updated":
      return "Perfil técnico atualizado";
    default:
      return activity.kind.replaceAll("_", " ");
  }
}

function Info({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
