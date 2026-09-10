import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardDateFilter } from "@/components/dashboard/dashboard-date-filter";
import { NewLeadDialog } from "@/app/(app)/leads/new-lead-dialog";

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Cabecalho de boas-vindas: primeira coisa que a pessoa le ao abrir o CRM.
 * O resumo (fila/horarios/tarefas) usa os mesmos numeros da secao de
 * atencao logo abaixo - nao e um dado novo, so a versao de uma linha dele.
 */
export function DashboardHeader({
  userFirstName,
  dayLabel,
  selectedDate,
  todayStr,
  sharedQueueLeads,
  appointmentsToday,
  overdueTasks,
  stages,
}: {
  userFirstName: string;
  dayLabel: string;
  selectedDate: string;
  todayStr: string;
  sharedQueueLeads: number;
  appointmentsToday: number;
  overdueTasks: number;
  stages: { id: string; name: string }[];
}) {
  const summaryParts = [
    sharedQueueLeads > 0 ? `${sharedQueueLeads} lead${sharedQueueLeads === 1 ? "" : "s"} na fila precisam de atenção` : null,
    appointmentsToday > 0 ? `${appointmentsToday} compromisso${appointmentsToday === 1 ? "" : "s"} hoje` : null,
    overdueTasks > 0 ? `${overdueTasks} tarefa${overdueTasks === 1 ? "" : "s"} atrasada${overdueTasks === 1 ? "" : "s"}` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="border-b border-border/70 pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-normal md:text-2xl">
            {greeting()}, {userFirstName}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{dayLabel}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {summaryParts.length > 0 ? summaryParts.join(" · ") : "Nada pendente por aqui — tudo em dia."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DashboardDateFilter selectedDate={selectedDate} todayStr={todayStr} />
          <NewLeadDialog stages={stages} />
          <Button asChild variant="outline" className="bg-background/60">
            <Link href="/atendimento">Abrir atendimento</Link>
          </Button>
          <Button asChild variant="brand">
            <Link href="/kanban">Abrir kanban</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
