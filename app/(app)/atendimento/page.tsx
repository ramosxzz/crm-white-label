import { redirect } from "next/navigation";
import Link from "next/link";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canSeeFullDashboard } from "@/lib/auth/roles";
import { listTenantUserOptions } from "@/lib/tenant/users";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SlaRow = {
  user_id: string;
  responses: number | string;
  avg_response_seconds: number | string;
  median_response_seconds: number | string;
  slowest_response_seconds: number | string;
  messages_sent: number | string;
  conversations: number | string;
};

const RANGES = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "90", label: "90 dias", days: 90 },
];

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours / 24)} d`;
}

/** Mediana e o numero que representa o dia a dia: a media e distorcida por
 * mensagens que chegam de madrugada e so sao respondidas na manha seguinte. */
function medianTone(seconds: number): string {
  if (seconds <= 0) return "text-muted-foreground";
  if (seconds <= 5 * 60) return "text-success";
  if (seconds <= 30 * 60) return "text-warning";
  return "text-destructive";
}

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams?: Promise<{ dias?: string }>;
}) {
  const ctx = await requireContext();
  if (!canSeeFullDashboard(ctx.role)) redirect("/dashboard");

  const params = await searchParams;
  const range = RANGES.find((r) => r.key === params?.dias) ?? RANGES[1];

  const to = new Date();
  const from = new Date(to.getTime() - range.days * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const [{ data }, users] = await Promise.all([
    supabase.rpc("attendant_sla_metrics", {
      p_tenant_id: ctx.tenantId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
    listTenantUserOptions(ctx.tenantId),
  ]);

  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const rows = ((data ?? []) as SlaRow[]).map((row) => ({
    userId: row.user_id,
    name: nameById.get(row.user_id) ?? `Usuario ${row.user_id.slice(0, 6)}`,
    responses: Number(row.responses ?? 0),
    avgSeconds: Number(row.avg_response_seconds ?? 0),
    medianSeconds: Number(row.median_response_seconds ?? 0),
    slowestSeconds: Number(row.slowest_response_seconds ?? 0),
    messagesSent: Number(row.messages_sent ?? 0),
    conversations: Number(row.conversations ?? 0),
  }));

  const totalResponses = rows.reduce((a, r) => a + r.responses, 0);
  const totalMessages = rows.reduce((a, r) => a + r.messagesSent, 0);
  // Mediana da equipe: ponderada pelo numero de respostas de cada atendente.
  const teamMedian =
    totalResponses > 0
      ? rows.reduce((a, r) => a + r.medianSeconds * r.responses, 0) / totalResponses
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Analise"
        title="Desempenho de atendimento"
        description="Tempo de resposta e volume por atendente."
        actions={
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/atendimento?dias=${r.key}`}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  r.key === range.key
                    ? "border-brand/40 bg-brand/15 text-brand"
                    : "border-border/70 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Tempo tipico de resposta</p>
              <p className={cn("mt-1 font-display text-2xl font-semibold", medianTone(teamMedian))}>
                {formatDuration(teamMedian)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Mediana da equipe no periodo</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Respostas dadas</p>
              <p className="mt-1 font-display text-2xl font-semibold">{totalResponses}</p>
              <p className="mt-1 text-xs text-muted-foreground">Clientes que ficaram esperando e foram atendidos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
              <p className="mt-1 font-display text-2xl font-semibold">{totalMessages}</p>
              <p className="mt-1 text-xs text-muted-foreground">Total da equipe no periodo</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/70 bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Atendente</th>
                    <th className="px-5 py-3 text-right font-medium">Tempo tipico</th>
                    <th className="px-5 py-3 text-right font-medium">Media</th>
                    <th className="px-5 py-3 text-right font-medium">Pior caso</th>
                    <th className="px-5 py-3 text-right font-medium">Respostas</th>
                    <th className="px-5 py-3 text-right font-medium">Conversas</th>
                    <th className="px-5 py-3 text-right font-medium">Mensagens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <p className="font-medium">Nenhum atendimento no periodo</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          As metricas aparecem conforme a equipe responder conversas.
                        </p>
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.userId} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3 font-medium">{row.name}</td>
                      <td className={cn("px-5 py-3 text-right font-semibold", medianTone(row.medianSeconds))}>
                        {formatDuration(row.medianSeconds)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {formatDuration(row.avgSeconds)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {formatDuration(row.slowestSeconds)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{row.responses}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{row.conversations}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{row.messagesSent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Tempo tipico</strong> e a mediana: metade das respostas foi mais rapida
          que isso. Use ela para avaliar o dia a dia. A <strong className="text-foreground">media</strong> costuma ser
          bem maior porque mensagens que chegam de madrugada ou fim de semana so sao respondidas horas depois, o que
          distorce o numero.
        </p>
      </div>
    </div>
  );
}
