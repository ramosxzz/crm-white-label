import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createReservation } from "../actions";
import { formatBRTFullDateTime } from "@/lib/date/brt";

export function ReservationForm({
  productId,
  leads,
  appointments,
}: {
  productId: string;
  leads: { id: string; name: string }[];
  appointments: { id: string; starts_at: string }[];
}) {
  return (
    <form action={createReservation} className="grid gap-2 md:grid-cols-[100px_1fr_1fr_auto]">
      <input type="hidden" name="product_id" value={productId} />
      <Input name="quantity" type="number" min="1" required placeholder="Qtd." />
      <select name="lead_id" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Cliente opcional</option>
        {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}
      </select>
      <select name="appointment_id" className="h-9 rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Horario opcional</option>
        {appointments.map((appointment) => <option key={appointment.id} value={appointment.id}>{formatBRTFullDateTime(appointment.starts_at)}</option>)}
      </select>
      <Button>Reservar</Button>
    </form>
  );
}
