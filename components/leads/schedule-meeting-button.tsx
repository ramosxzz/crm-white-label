"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAppointmentForLead } from "./schedule-meeting-action";
import { MeetingMiniAgenda } from "./meeting-mini-agenda";

export function ScheduleMeetingButton({
  leadId,
  leadName,
  professionals,
  users = [],
  services,
  variant = "outline",
  size = "default",
  className,
}: {
  leadId: string;
  leadName: string;
  professionals: { id: string; name: string }[];
  users?: { id: string; name: string }[];
  services: { id: string; name: string; duration_minutes: number }[];
  variant?: "outline" | "brand" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  function pickFromAgenda(date: string, userId: string) {
    const time = startsAt.split("T")[1] || "09:00";
    setStartsAt(`${date}T${time}`);
    setAssignedTo(userId);
  }

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      try {
        await createAppointmentForLead(formData);
        setMsg("Reunião agendada!");
        setTimeout(() => setOpen(false), 800);
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMsg(null);
      setStartsAt("");
      setAssignedTo("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant as never} size={size as never} className={className} title="Agendar reunião">
          <CalendarPlus className="h-4 w-4" />
          {size !== "icon" && "Agendar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-12 sm:px-6">
          <DialogTitle>Agendar reunião com {leadName}</DialogTitle>
          <DialogDescription>
            Consulte a disponibilidade e defina os dados do compromisso.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="lead_id" value={leadId} />
          <input type="hidden" name="lead_name" value={leadName} />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)] lg:items-start">
              <MeetingMiniAgenda selectedUserId={assignedTo} onPickDateAndUser={pickFromAgenda} />

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sm-start">Data e hora</Label>
                    <Input
                      id="sm-start"
                      name="starts_at"
                      type="datetime-local"
                      required
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sm-duration">Duração (min)</Label>
                    <Input id="sm-duration" name="duration_minutes" type="number" min="15" defaultValue="60" required />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sm-assignee">Responsável</Label>
                    <select
                      id="sm-assignee"
                      name="assigned_to"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                    >
                      <option value="">Sem responsável</option>
                      {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sm-professional">Profissional</Label>
                    <select id="sm-professional" name="professional_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
                      <option value="">Nao definido</option>
                      {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="sm-service">Serviço</Label>
                  <select id="sm-service" name="service_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand/60">
                    <option value="">Nao definido</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sm-notes">Observações</Label>
                  <Textarea id="sm-notes" name="notes" rows={4} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 items-center gap-3 border-t border-border/70 bg-background px-5 py-4 sm:px-6">
            {msg && <p className="mr-auto text-sm text-muted-foreground" role="status">{msg}</p>}
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Agendando…</> : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
