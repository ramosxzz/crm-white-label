import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clock3, Phone, UserRound, Users, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canManageOperationalSetup } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { createProfessional, createService, listScheduledCallsForTenant, listScheduledMessagesForTenant, transitionAppointmentStatus } from "./actions";
import { AppointmentDialog } from "./appointment-dialog";
import { MeetingOutcomeDialog } from "./meeting-outcome-dialog";
import { MonthCalendar } from "./month-calendar";
import { ScheduledMessagesPanel } from "./scheduled-messages-panel";
import { ScheduledCallsPanel } from "../ligacoes/scheduled-calls-panel";
import { formatBRTTime } from "@/lib/date/brt";

const statusLabel = { scheduled: "Agendado", confirmed: "Confirmado", completed: "Concluido", cancelled: "Cancelado", no_show: "Nao compareceu" };

function brtDay() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function offsetDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00-03:00`);
  date.setDate(date.getDate() + amount);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function monthOf(day: string) {
  return day.slice(0, 7);
}

function offsetMonth(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const start = `${month}-01`;
  const end = `${offsetMonth(month, 1)}-01`;
  return { start, end };
}

export default async function AgendaPage({ searchParams }: { searchParams?: Promise<{ day?: string }> }) {
  const ctx = await requireContext();
  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day ?? "") ? params!.day! : brtDay();
  const nextDay = offsetDay(day, 1);
  const month = monthOf(day);
  const { start: monthStart, end: monthEnd } = monthRange(month);
  const supabase = await createClient();
  const [{ data: appointments }, { data: monthAppointments }, { data: leads }, { data: professionals }, { data: services }, users, scheduledMessages, scheduledCalls] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, duration_minutes, status, outcome, notes, kind, leads(id, name), professionals(name), services(name)")
      .eq("tenant_id", ctx.tenantId)
      .gte("starts_at", `${day}T00:00:00-03:00`)
      .lt("starts_at", `${nextDay}T00:00:00-03:00`)
      .order("starts_at"),
    supabase
      .from("appointments")
      .select("starts_at")
      .eq("tenant_id", ctx.tenantId)
      .gte("starts_at", `${monthStart}T00:00:00-03:00`)
      .lt("starts_at", `${monthEnd}T00:00:00-03:00`),
    supabase.from("leads").select("id, name").eq("tenant_id", ctx.tenantId).order("name"),
    supabase.from("professionals").select("id, name").eq("tenant_id", ctx.tenantId).eq("is_active", true).order("name"),
    supabase.from("services").select("id, name, duration_minutes").eq("tenant_id", ctx.tenantId).eq("is_active", true).order("name"),
    listTenantUserOptions(ctx.tenantId),
    listScheduledMessagesForTenant(),
    listScheduledCallsForTenant(),
  ]);
  const daysWithAppointments = new Set(
    (monthAppointments ?? []).map((a) =>
      new Date(a.starts_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    ),
  );
  const canManage = canManageOperationalSetup(ctx.role);

  return (
    <div>
      <PageHeader eyebrow="Atendimento" title="Agenda" description="Horarios internos da equipe" actions={<AppointmentDialog leads={leads ?? []} users={users} professionals={professionals ?? []} services={services ?? []} />} />
      <div className="space-y-5 p-6">
        <div className="grid gap-5 md:grid-cols-[280px_1fr]">
          <div className="rounded-xl border border-border/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                <Link href={`/agenda?day=${offsetMonth(month, -1)}-01`}><ChevronLeft className="h-4 w-4" /></Link>
              </Button>
              <p className="text-sm font-semibold capitalize">
                {new Date(`${month}-01T12:00:00-03:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </p>
              <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                <Link href={`/agenda?day=${offsetMonth(month, 1)}-01`}><ChevronRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <MonthCalendar month={month} selectedDay={day} today={brtDay()} daysWithAppointments={daysWithAppointments} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/70 pb-4">
              <Button asChild variant="outline" size="icon"><Link href={`/agenda?day=${offsetDay(day, -1)}`}><ChevronLeft className="h-4 w-4" /></Link></Button>
              <Input type="date" value={day} readOnly className="w-40" />
              <Button asChild variant="outline" size="icon"><Link href={`/agenda?day=${nextDay}`}><ChevronRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="ghost" size="sm"><Link href={`/agenda?day=${brtDay()}`}>Hoje</Link></Button>
            </div>

            {(appointments ?? []).length === 0 && <div className="border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">Nenhum horario neste dia.</div>}
        <div className="divide-y divide-border/70 border-y border-border/70">
          {(appointments ?? []).map((appointment) => {
            const lead = appointment.leads as unknown as { id: string; name: string } | null;
            const professional = appointment.professionals as unknown as { name: string } | null;
            const service = appointment.services as unknown as { name: string } | null;
            const appointmentKind = (appointment as { kind?: string }).kind ?? "meeting";
            return (
              <div key={appointment.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="w-20 shrink-0">
                  <p className="font-mono text-lg font-semibold">{formatBRTTime(appointment.starts_at)}</p>
                  <p className="text-xs text-muted-foreground">{appointment.duration_minutes} min</p>
                </div>
                <div className="min-w-48 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    {appointmentKind === "call" && <Phone className="h-3.5 w-3.5 text-brand" />}
                    {appointmentKind === "internal" && <Users className="h-3.5 w-3.5 text-brand" />}
                    {appointmentKind === "internal"
                      ? appointment.notes?.split("\n")[0] || "Alinhamento interno"
                      : lead?.name ?? "Sem cliente vinculado"}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><UserRound className="h-3 w-3" />{professional?.name ?? "Sem profissional"}</span>
                    {appointmentKind === "meeting" && (
                      <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{service?.name ?? "Sem servico"}</span>
                    )}
                  </p>
                </div>
                <Badge variant={appointmentKind === "internal" ? "outline" : "secondary"}>
                  {appointmentKind === "call" ? "Ligação" : appointmentKind === "internal" ? "Interno" : "Reunião"}
                </Badge>
                <Badge variant={appointment.status === "completed" ? "success" : appointment.status === "cancelled" || appointment.status === "no_show" ? "destructive" : "outline"}>
                  {statusLabel[appointment.status as keyof typeof statusLabel]}
                </Badge>
                <div className="flex gap-1">
                  {appointment.status === "scheduled" && <StatusButton id={appointment.id} status="confirmed" title="Confirmar"><Check className="h-4 w-4" /></StatusButton>}
                  <MeetingOutcomeDialog
                    appointmentId={appointment.id}
                    leadName={lead?.name ?? "Sem cliente"}
                    currentOutcome={(appointment as { outcome?: string | null }).outcome ?? null}
                  />
                  {(appointment.status === "scheduled" || appointment.status === "confirmed") && <StatusButton id={appointment.id} status="cancelled" title="Cancelar"><X className="h-4 w-4" /></StatusButton>}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>

        <div className={`grid items-start gap-5 ${ctx.tenant.calls_dashboard_enabled ? "md:grid-cols-2" : ""}`}>
          {ctx.tenant.calls_dashboard_enabled && <ScheduledCallsPanel calls={scheduledCalls} />}
          <ScheduledMessagesPanel messages={scheduledMessages} showCallButton={ctx.tenant.calls_dashboard_enabled} />
        </div>

        {canManage && (
          <div className="grid gap-5 border-t border-border/70 pt-5 md:grid-cols-2">
            <form action={createProfessional} className="space-y-3">
              <h2 className="text-sm font-semibold">Cadastrar profissional</h2>
              <div className="flex gap-2"><Input name="name" required placeholder="Nome" /><Input name="phone" placeholder="Telefone" /><Button>Adicionar</Button></div>
            </form>
            <form action={createService} className="space-y-3">
              <h2 className="text-sm font-semibold">Cadastrar servico</h2>
              <div className="grid grid-cols-[1fr_90px_100px_auto] gap-2"><Input name="name" required placeholder="Servico" /><Input name="duration_minutes" type="number" min="15" defaultValue="60" /><Input name="price" type="number" min="0" step="0.01" placeholder="Preco" /><Button>Adicionar</Button></div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusButton({ id, status, title, children }: { id: string; status: string; title: string; children: React.ReactNode }) {
  return (
    <form action={transitionAppointmentStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button size="icon" variant="ghost" className="h-8 w-8" title={title}>{children}</Button>
    </form>
  );
}
