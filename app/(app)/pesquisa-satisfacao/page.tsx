import { notFound } from "next/navigation";
import { Heart, MessageSquareQuote, Star } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatBRTDateTime } from "@/lib/date/brt";

type SurveyResponse = {
  id: string;
  employee_name: string | null;
  service_rating: number | null;
  nps_score: number;
  comments: string | null;
  created_at: string;
};

export default async function SatisfactionSurveyPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.satisfaction_survey_enabled) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("satisfaction_survey_responses")
    .select("id, employee_name, service_rating, nps_score, comments, created_at")
    .eq("tenant_id", ctx.tenant.id)
    .order("created_at", { ascending: false })
    .limit(500);

  const surveys = (data ?? []) as SurveyResponse[];
  const total = surveys.length;

  let promoters = 0;
  let detractors = 0;
  surveys.forEach((s) => {
    if (s.nps_score >= 9) promoters++;
    else if (s.nps_score <= 6) detractors++;
  });
  const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
  const promotersPct = total > 0 ? Math.round((promoters / total) * 100) : 0;
  const detractorsPct = total > 0 ? Math.round((detractors / total) * 100) : 0;

  const byEmployee = new Map<string, { sum: number; count: number }>();
  for (const s of surveys) {
    if (!s.employee_name || s.service_rating == null) continue;
    const acc = byEmployee.get(s.employee_name) ?? { sum: 0, count: 0 };
    acc.sum += s.service_rating;
    acc.count += 1;
    byEmployee.set(s.employee_name, acc);
  }
  const employeeRanking = [...byEmployee.entries()]
    .map(([name, { sum, count }]) => ({ name, avg: sum / count, count }))
    .sort((a, b) => b.avg - a.avg);

  const feedbacks = surveys.filter((s) => s.comments && s.comments.trim().length > 0);

  return (
    <div>
      <PageHeader title="Pesquisa de Satisfação" description="Respostas do formulário de satisfação enviado aos clientes" />

      <div className="grid gap-4 p-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-destructive" /> NPS Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="min-w-[140px] rounded-xl border border-border/70 bg-muted/40 p-4 text-center">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">NPS Geral</div>
                <div
                  className={cn(
                    "font-display my-1.5 text-4xl font-bold",
                    npsScore === null
                      ? "text-muted-foreground"
                      : npsScore >= 50
                        ? "text-success"
                        : npsScore >= 0
                          ? "text-amber-500"
                          : "text-destructive",
                  )}
                >
                  {npsScore === null ? "N/A" : (npsScore > 0 ? "+" : "") + npsScore}
                </div>
                <div className="text-xs text-muted-foreground">{total} respostas</div>
              </div>

              <div className="flex flex-1 min-w-[220px] flex-col gap-3">
                <RatioBar label="Promotores (9-10)" pct={promotersPct} className="bg-success" />
                <RatioBar label="Detratores (0-6)" pct={detractorsPct} className="bg-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 max-h-[480px] overflow-y-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="h-4 w-4 text-brand" /> Comentários e Sugestões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum comentário por extenso recebido.</p>
            ) : (
              feedbacks.map((s) => (
                <div key={s.id} className="relative pl-4">
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 h-2 w-2 rounded-full",
                      s.nps_score >= 9 ? "bg-success" : s.nps_score <= 6 ? "bg-destructive" : "bg-amber-500",
                    )}
                  />
                  <p className="text-sm italic">&ldquo;{s.comments}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong>{s.employee_name ?? "Sem funcionária"}</strong> (Nota {s.nps_score}) ·{" "}
                    {formatBRTDateTime(s.created_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> Avaliação por vendedora
            </CardTitle>
          </CardHeader>
          <CardContent>
            {employeeRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma avaliação de atendimento registrada ainda.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {employeeRanking.map((e) => (
                  <div key={e.name} className="rounded-lg border border-border/70 bg-card/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{e.name}</span>
                      <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                        <Star className="h-3.5 w-3.5 fill-amber-500" /> {e.avg.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{e.count} avaliações</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RatioBar({ label, pct, className }: { label: string; pct: number; className: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <strong className="tabular-nums">{pct}%</strong>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", className)} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}
