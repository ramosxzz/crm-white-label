import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MessageCircle,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatPhoneBR, initials } from "@/lib/utils";
import { LeadStageSelect } from "./lead-stage-select";
import { LeadFilesPanel } from "./lead-files-panel";
import { LeadDeleteButton } from "@/components/leads/lead-delete-button";
import { ScheduleMeetingButton } from "@/components/leads/schedule-meeting-button";
import { CallButton } from "@/components/leads/call-button";
import { TechnicalProfilePanel, type Definition } from "./technical-profile-panel";
import { TaskPanel } from "./task-panel";
import { NotesPanel } from "./notes-panel";
import { ValuePanel } from "./value-panel";
import { formatBRTFullDate, formatBRTFullDateTime } from "@/lib/date/brt";
import { LeadTagsPanel } from "./lead-tags-panel";
import { LeadEmailsPanel } from "./lead-emails-panel";
import { LeadTimeline } from "@/components/leads/lead-timeline";

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

  const [{ data: stages }, { data: files }, { data: activities }, { data: technicalDefinitions }, { data: tasks }, { data: professionals }, { data: services }, { data: valueItems }, { data: tagCatalog }, users, { data: googleAccount }] = await Promise.all([
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
    supabase
      .from("lead_tag_catalog")
      .select("name")
      .eq("tenant_id", ctx.tenantId)
      .order("normalized_name", { ascending: true })
      .limit(500),
    listTenantUserOptions(ctx.tenantId),
    supabase.from("google_accounts").select("id").eq("tenant_id", ctx.tenantId).maybeSingle(),
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
      <header className="border-b border-border/50 px-4 py-5 sm:px-8 sm:py-6">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link href="/leads"><ArrowLeft className="h-4 w-4" /> Voltar para leads</Link>
        </Button>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0 ring-2 ring-brand/20">
              <AvatarFallback className="bg-brand/15 font-display text-lg font-semibold text-brand">
                {initials(lead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{lead.name}</h1>
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
                  Criado em {formatBRTFullDate(lead.created_at)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <ScheduleMeetingButton
              leadId={lead.id}
              leadName={lead.name}
              professionals={professionals ?? []}
              users={users}
              services={(services ?? []) as { id: string; name: string; duration_minutes: number }[]}
            />
            {lead.phone && ctx.tenant.calls_dashboard_enabled && <CallButton leadId={lead.id} phone={lead.phone} />}
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

      <div className="grid gap-6 p-4 sm:p-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
              <Info label="Estágio">
                <LeadStageSelect leadId={lead.id} stageId={lead.stage_id} stages={stages ?? []} />
              </Info>
              <Info label="Valor">
                <ValuePanel leadId={lead.id} items={valueItems ?? []} totalCents={lead.value_cents ?? 0} />
              </Info>
              <Info label="Origem">{lead.source ?? "-"}</Info>
              <Info label="Atualizado">{formatBRTFullDateTime(lead.updated_at)}</Info>
              <Info label="Tags" full>
                <LeadTagsPanel
                  leadId={lead.id}
                  initialTags={lead.tags ?? []}
                  catalog={(tagCatalog ?? []).map((tag) => tag.name)}
                />
              </Info>
              <Info label="Observações" full>
                <p className="whitespace-pre-wrap text-muted-foreground">{lead.notes ?? "Sem observações."}</p>
              </Info>
            </CardContent>
          </Card>

          {lead.email && (
            <Card>
              <CardHeader>
                <CardTitle>Emails</CardTitle>
              </CardHeader>
              <CardContent>
                <LeadEmailsPanel leadId={lead.id} googleConnected={!!googleAccount} />
              </CardContent>
            </Card>
          )}

          <TechnicalProfilePanel
            leadId={lead.id}
            definitions={(technicalDefinitions ?? []) as Definition[]}
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
          <CardContent className="text-sm">
            <LeadTimeline leadId={lead.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}
