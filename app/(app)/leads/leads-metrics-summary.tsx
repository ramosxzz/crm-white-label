import { Clock3, Star, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StageMetric = { id: string; name: string; color: string; count: number; percentage: number };
type QualityMetric = { stars: number; count: number; percentage: number };

function formatDuration(seconds: number) {
  if (!seconds) return "Sem respostas";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

export function LeadsMetricsSummary({
  total,
  responseSeconds,
  respondedConversations,
  stages,
  quality,
  qualityAverage,
  ratedLeads,
  mqlLeads,
  mqlPercentage,
}: {
  total: number;
  responseSeconds: number;
  respondedConversations: number;
  stages: StageMetric[];
  quality: QualityMetric[];
  qualityAverage: number;
  ratedLeads: number;
  mqlLeads: number;
  mqlPercentage: number;
}) {
  return (
    <div className="mb-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Leads do período" value={String(total)} detail="Todos os resultados filtrados" />
        <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Tempo de resposta" value={formatDuration(responseSeconds)} detail={`${respondedConversations} conversa${respondedConversations === 1 ? "" : "s"} medida${respondedConversations === 1 ? "" : "s"}`} />
        <MetricCard icon={<Star className="h-4 w-4" />} label="Qualificação" value={ratedLeads ? `${qualityAverage.toFixed(1)} estrelas` : "Sem avaliações"} detail={`${ratedLeads} de ${total} leads avaliados`} />
        <MetricCard icon={<Target className="h-4 w-4" />} label="MQL do período" value={`${mqlPercentage}%`} detail={`${mqlLeads} lead${mqlLeads === 1 ? "" : "s"} com 3 estrelas ou mais`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Avanço das etapas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stages.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lead no período.</p> : stages.map((stage) => (
              <div key={stage.id} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium">{stage.name}</span>
                  <span className="tabular-nums text-muted-foreground">{stage.count} · {stage.percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${stage.percentage}%`, backgroundColor: stage.color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Qualificação dos leads</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[...quality].reverse().map((item) => (
              <div key={item.stars} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="flex items-center gap-1 font-medium">
                    {item.stars === 0 ? "Sem avaliação" : Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} className={cn("h-3.5 w-3.5", index < item.stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25")} />
                    ))}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.count} · {item.percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", item.stars === 0 ? "bg-muted-foreground/40" : "bg-amber-400")} style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
