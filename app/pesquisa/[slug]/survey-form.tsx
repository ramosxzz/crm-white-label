"use client";

import { useState } from "react";
import { Star, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { submitSatisfactionSurvey } from "./actions";

export function SurveyForm({ slug, employees }: { slug: string; employees: string[] }) {
  const [employee, setEmployee] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [nps, setNps] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee || nps === null) {
      setError("Preencha quem te atendeu e a nota de recomendação.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await submitSatisfactionSurvey({
      slug,
      employee_name: employee,
      service_rating: rating > 0 ? rating : undefined,
      nps_score: nps,
      comments: comments.trim() || undefined,
      website,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-6 py-12 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="text-lg font-semibold">Obrigado pela sua resposta!</p>
        <p className="text-sm text-muted-foreground">Sua opinião nos ajuda a melhorar cada vez mais.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border/70 bg-card/60 p-6">
      {/* honeypot - invisivel pra humano */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <div>
        <Label>Qual funcionária lhe atendeu? *</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {employees.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setEmployee(name)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                employee === name
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border/70 bg-background hover:border-brand/60",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Como foi seu atendimento?</Label>
        <div className="mt-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "h-8 w-8 transition-colors",
                  (hoverRating || rating) >= n ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Em uma escala de 0 a 10, o quanto você recomendaria a gente para outros lojistas? *</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => n).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNps(n)}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg border text-sm font-medium transition-colors",
                nps === n
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border/70 bg-background hover:border-brand/60",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="comments">Tem alguma sugestão, elogio ou crítica que gostaria de compartilhar?</Label>
        <Textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          className="mt-2"
          placeholder="Sua resposta"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" variant="brand" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? "Enviando..." : "Enviar"}
      </Button>
    </form>
  );
}
