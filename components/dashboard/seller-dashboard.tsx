import { MessageCircle, Inbox, Users, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SellerDashboardData {
  dateLabel: string;
  messagesSentToday: number;
  conversationsToday: number;
  assignedLeads: number;
  newAssignedToday: number;
}

export function SellerDashboard({ data }: { data: SellerDashboardData }) {
  return (
    <div className="space-y-6 p-6">
      <p className="text-sm text-muted-foreground">{data.dateLabel}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<MessageCircle className="h-5 w-5" />}
          label="Mensagens Enviadas Hoje"
          value={String(data.messagesSentToday)}
        />
        <KpiCard
          icon={<Inbox className="h-5 w-5" />}
          label="Conversas Atendidas Hoje"
          value={String(data.conversationsToday)}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Leads Atribuídos"
          value={String(data.assignedLeads)}
        />
        <KpiCard
          icon={<UserPlus className="h-5 w-5" />}
          label="Leads Novos Hoje"
          value={String(data.newAssignedToday)}
        />
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="overflow-hidden border-border/60 bg-card/80">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/20">
          {icon}
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={cn("font-display block text-xl font-semibold")}>{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
