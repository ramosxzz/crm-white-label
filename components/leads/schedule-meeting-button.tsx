"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAppointmentForLead } from "./schedule-meeting-action";

export function ScheduleMeetingButton({
  leadId,
  leadName,
  professionals,
  users = [],
  services,
  variant = "outline",
  size = "default",
}: {
  leadId: string;
  leadName: string;
  professionals: { id: string; name: string }[];
  users?: { id: string; name: string }[];
  services: { id: string; name: string; duration_minutes: number }[];
  variant?: "outline" | "brand" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      try {
        await createAppointmentForLead(formData);
        setMsg("Reuniao agendada!");
        setTimeout(() => setOpen(false), 800);
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant as never} size={size as never}>
          <CalendarPlus className="h-4 w-4" />
          {size !== "icon" && " Agendar reuniao"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar reuniao com {leadName}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="lead_id" value={leadId} />
          <input type="hidden" name="lead_name" value={leadName} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sm-start">Data e hora</Label>
              <Input id="sm-start" name="starts_at" type="datetime-local" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-duration">Duracao (min)</Label>
              <Input id="sm-duration" name="duration_minutes" type="number" min="15" defaultValue="60" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sm-assignee">Responsavel</Label>
              <select id="sm-assignee" name="assigned_to" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sem responsavel</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sm-professional">Profissional</Label>
              <select id="sm-professional" name="professional_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Nao definido</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-service">Servico</Label>
            <select id="sm-service" name="service_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Nao definido</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-notes">Observacoes</Label>
            <Textarea id="sm-notes" name="notes" />
          </div>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          <DialogFooter>
            <Button disabled={pending}>
              {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Agendando...</> : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
