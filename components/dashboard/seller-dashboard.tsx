import { MessageCircle, Inbox, Users, UserPlus, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SellerDashboardData {
  dateLabel: string;
  messagesSentToday: number;
  conversationsToday: number;
  assignedLeads: number;
  newAssignedToday: number;
  sharedNumber?: boolean;
}

export function SellerDashboard({ data }: { data: SellerDashboardData }) {
  // Num numero atendido pela equipe toda, o painel fala do numero, nao da
  // pessoa: quem responde pelo aparelho nao passa pelo CRM e a mensagem chega
  // sem autor, entao nao ha como dizer quem enviou o que. Rotular como "meu"
  // faria cada vendedora ler o movimento da loja inteira como se fosse dela.
  const shared = data.sharedNumber === true;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground">{data.dateLabel}</p>
        {shared && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Share2 className="h-3.5 w-3.5" />
            Número compartilhado — números da equipe
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<MessageCircle className="h-5 w-5" />}
          label={shared ? "Mensagens Enviadas Hoje (equipe)" : "Mensagens Enviadas Hoje"}
          value={String(data.messagesSentToday)}
        />
        <KpiCard
          icon={<Inbox className="h-5 w-5" />}
          label={shared ? "Conversas Atendidas Hoje (equipe)" : "Conversas Atendidas Hoje"}
          value={String(data.conversationsToday)}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label={shared ? "Clientes no Número" : "Leads Atribuídos"}
          value={String(data.assignedLeads)}
        />
        <KpiCard
          icon={<UserPlus className="h-5 w-5" />}
          label="Leads Novos Hoje"
          value={String(data.newAssignedToday)}
        />
      </div>

      {shared && (
        <p className="text-xs text-muted-foreground">
          Como o atendimento sai de um número usado por toda a equipe, estes valores
          são do número — não dá para separar por pessoa. Para ver o desempenho
          individual, cada vendedora precisa do próprio número.
        </p>
      )}
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
