import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAppointment } from "./actions";

function leadCode(id: string) {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function AppointmentDialog({
  leads,
  users,
  professionals,
  services,
}: {
  leads: { id: string; name: string }[];
  users: { id: string; name: string }[];
  professionals: { id: string; name: string }[];
  services: { id: string; name: string; duration_minutes: number }[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button><CalendarPlus className="mr-2 h-4 w-4" />Novo horario</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo horario</DialogTitle></DialogHeader>
        <form action={createAppointment} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-lead">Cliente</Label>
            <select id="agenda-lead" name="lead_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Sem cliente vinculado</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{leadCode(lead.id)} - {lead.name}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="agenda-start">Data e hora</Label><Input id="agenda-start" name="starts_at" type="datetime-local" required /></div>
            <div className="space-y-1.5"><Label htmlFor="agenda-duration">Duracao (min)</Label><Input id="agenda-duration" name="duration_minutes" type="number" min="15" defaultValue="60" required /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="agenda-assignee">Responsavel</Label>
              <select id="agenda-assignee" name="assigned_to" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Sem responsavel</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agenda-professional">Profissional</Label>
              <select id="agenda-professional" name="professional_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Nao definido</option>
                {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="agenda-service">Servico</Label>
            <select id="agenda-service" name="service_id" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Nao definido</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="agenda-notes">Observacoes</Label><Textarea id="agenda-notes" name="notes" /></div>
          <DialogFooter><Button>Agendar</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
