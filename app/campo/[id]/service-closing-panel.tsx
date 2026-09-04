"use client";

import { useState } from "react";
import { ClipboardCheck, FilePlus2, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { queueMutation } from "@/lib/field-service/offline";
import {
  SERVICE_REPORT_CHECKLIST,
  type ServiceReportChecklistKey,
} from "@/lib/field-service/checklist";
import { notify, notifyError } from "@/lib/ui/feedback";
import { syncNow } from "../sync";

type ClosureType = "finalizado" | "finalizado_orcamento" | "assistencia";
type Answers = Partial<Record<ServiceReportChecklistKey, boolean>>;

const OUTCOMES: Array<{
  value: ClosureType;
  title: string;
  description: string;
  Icon: typeof ClipboardCheck;
}> = [
  {
    value: "finalizado",
    title: "Finalizado",
    description: "Serviço concluído normalmente.",
    Icon: ClipboardCheck,
  },
  {
    value: "finalizado_orcamento",
    title: "Finalizado + orçamento",
    description: "Conclui esta OS e deixa um orçamento ligado ao cliente.",
    Icon: FilePlus2,
  },
  {
    value: "assistencia",
    title: "Assistência ou cortesia",
    description: "Fecha sem valor e sem gerar comissão.",
    Icon: Gift,
  },
];

export function ServiceClosingPanel({
  serviceOrderId,
  hasSignature,
  initialAnswers,
  initialObservations,
  redirectTo = "/campo",
}: {
  serviceOrderId: string;
  hasSignature: boolean;
  initialAnswers?: Record<string, boolean>;
  initialObservations?: string | null;
  /** Pra onde ir apos fechar - o celular do tecnico volta pra lista (/campo);
      usado tambem pelo escritorio na tela da OS, que deve continuar ali. */
  redirectTo?: string;
}) {
  const [answers, setAnswers] = useState<Answers>((initialAnswers ?? {}) as Answers);
  const [closureType, setClosureType] = useState<ClosureType>("finalizado");
  const [observations, setObservations] = useState(initialObservations ?? "");
  const [quoteDescription, setQuoteDescription] = useState("");
  const [pending, setPending] = useState(false);

  const answeredCount = SERVICE_REPORT_CHECKLIST.filter(
    (item) => typeof answers[item.key] === "boolean",
  ).length;
  const complete = answeredCount === SERVICE_REPORT_CHECKLIST.length;

  async function finish() {
    if (!complete) {
      notify({
        title: "Complete o laudo",
        description: `Faltam ${SERVICE_REPORT_CHECKLIST.length - answeredCount} respostas.`,
        tone: "error",
      });
      return;
    }
    if (!hasSignature) {
      notify({ title: "Colete a assinatura do cliente primeiro", tone: "error" });
      return;
    }
    if (closureType === "finalizado_orcamento" && !quoteDescription.trim()) {
      notify({ title: "Descreva o orçamento solicitado", tone: "error" });
      return;
    }

    setPending(true);
    try {
      await queueMutation({
        kind: "closure",
        serviceOrderId,
        payload: {
          closure_type: closureType,
          answers,
          observations: observations.trim(),
          quote_description: quoteDescription.trim(),
        },
      });

      if (navigator.onLine) {
        const outcome = await syncNow();
        if (outcome.failed.length > 0) throw new Error(outcome.failed[0].error);
        notify({ title: "Atendimento fechado", tone: "success" });
        window.location.assign(redirectTo);
      } else {
        notify({
          title: "Fechamento guardado no celular",
          description: "Será enviado automaticamente quando a internet voltar.",
          tone: "info",
        });
        window.location.assign(redirectTo);
      }
    } catch (error) {
      notifyError(error, "Não foi possível fechar o atendimento");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5 rounded-xl border border-border/70 bg-card p-4 shadow-elev-1">
      <header>
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="h-4 w-4 text-brand" /> Laudo e fechamento
          </h2>
          <span className="text-xs font-medium text-muted-foreground">
            {answeredCount}/{SERVICE_REPORT_CHECKLIST.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Um único laudo para toda a ordem de serviço.
        </p>
      </header>

      <div className="space-y-3">
        {SERVICE_REPORT_CHECKLIST.map((item, index) => (
          <div
            key={item.key}
            className="rounded-lg border border-border/60 bg-muted/20 p-3"
          >
            <p className="text-sm">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">
                {String(index + 1).padStart(2, "0")}.
              </span>
              {item.label}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([true, false] as const).map((value) => {
                const active = answers[item.key] === value;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setAnswers((current) => ({ ...current, [item.key]: value }))}
                    className={
                      active
                        ? "rounded-md bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground"
                        : "rounded-md border border-border/70 px-3 py-2 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {value ? "Sim" : "Não"}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="report-observations">Observações do laudo</Label>
        <Textarea
          id="report-observations"
          rows={4}
          value={observations}
          onChange={(event) => setObservations(event.target.value)}
          placeholder="Descreva manchas, condições especiais, orientação dada ao cliente..."
        />
      </div>

      <div className="space-y-2">
        <Label>Resultado do atendimento</Label>
        <div className="grid gap-2">
          {OUTCOMES.map(({ value, title, description, Icon }) => {
            const active = closureType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setClosureType(value)}
                className={
                  active
                    ? "flex items-start gap-3 rounded-lg border border-brand bg-brand/10 p-3 text-left"
                    : "flex items-start gap-3 rounded-lg border border-border/70 p-3 text-left"
                }
              >
                <Icon className={active ? "mt-0.5 h-4 w-4 text-brand" : "mt-0.5 h-4 w-4 text-muted-foreground"} />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {closureType === "finalizado_orcamento" && (
        <div className="space-y-1.5">
          <Label htmlFor="quote-description">O que deve ser orçado?</Label>
          <Textarea
            id="quote-description"
            rows={3}
            value={quoteDescription}
            onChange={(event) => setQuoteDescription(event.target.value)}
            placeholder="Ex.: impermeabilização de duas almofadas, executar em outra data."
          />
        </div>
      )}

      {closureType === "assistencia" && (
        <p className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
          Este fechamento zera o valor da OS e bloqueia faturamento e comissões.
        </p>
      )}

      {!hasSignature && (
        <p className="text-center text-xs text-muted-foreground">
          Colete a assinatura do cliente para liberar o fechamento.
        </p>
      )}

      <Button
        type="button"
        variant="brand"
        size="lg"
        className="w-full"
        disabled={pending || !complete || !hasSignature}
        onClick={finish}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        Confirmar fechamento
      </Button>
    </section>
  );
}
