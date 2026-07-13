import { notFound } from "next/navigation";
import { Heart, MessageSquareQuote } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSatisfactionSurveys } from "@/lib/integrations/satisfaction-survey";
import { cn } from "@/lib/utils";

export default async function SatisfactionSurveyPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.satisfaction_survey_enabled) notFound();

  const surveys = await fetchSatisfactionSurveys();
  const total = surveys.length;

  let promoters = 0;
  let detractors = 0;
  surveys.forEach((s) => {
    if (s.npsScore >= 9) promoters++;
    else if (s.npsScore <= 6) detractors++;
  });
  const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
  const promotersPct = total > 0 ? Math.round((promoters / total) * 100) : 0;
  const detractorsPct = total > 0 ? Math.round((detractors / total) * 100) : 0;

  const bars = [
    {
      label: "Qualidade Ótima/Boa",
      pct: pctFor(surveys, (s) => s.productQuality === "Excelente" || s.productQuality === "Bom"),
    },
    {
      label: "Atendimento Ótimo/Bom",
      pct: pctFor(surveys, (s) => s.serviceRating === "Excelente" || s.serviceRating === "Bom"),
    },
    {
      label: "Entrega no Prazo/Expectativa",
      pct: pctFor(surveys, (s) => s.deliveryRating === "Sim, totalmente"),
    },
    {
      label: "Compra Fácil/Muito Fácil",
      pct: pctFor(surveys, (s) => s.purchaseEase === "Muito Fácil" || s.purchaseEase === "Fácil"),
    },
  ];

  const feedbacks = surveys.filter((s) => s.comments && s.comments.trim().length > 0);

  return (
    <div>
      <PageHeader title="Pesquisa de Satisfação" description="Respostas do formulário de satisfação enviado aos clientes" />

      <div className="grid gap-4 p-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-destructive" /> Pesquisa de Satisfação
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

            <div className="mt-6 flex flex-col gap-4">
              {total === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum dado detalhado de avaliação disponível.</p>
              ) : (
                bars.map((b) => <RatioBar key={b.label} label={b.label} pct={b.pct} className="bg-brand" />)
              )}
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
                      s.npsScore >= 9 ? "bg-success" : s.npsScore <= 6 ? "bg-destructive" : "bg-amber-500",
                    )}
                  />
                  <p className="text-sm italic">&ldquo;{s.comments}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <strong>{s.boutiqueName ?? "Lojista Anônimo"}</strong> (Nota {s.npsScore}) ·{" "}
                    {new Date(s.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function pctFor<T>(items: T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter(predicate).length / items.length) * 100);
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
