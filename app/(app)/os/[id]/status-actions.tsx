"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import {
  SERVICE_ORDER_STATUS_LABEL,
  nextServiceOrderStatuses,
} from "@/lib/field-service/status";
import { COMMISSION_PARTY_LABEL } from "@/lib/field-service/commissions";
import { formatCurrencyBRL } from "@/lib/utils";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import {
  cancelServiceOrderClosure,
  previewServiceOrderCommissions,
  transitionServiceOrder,
} from "../actions";

// O que cada papel pode disparar. A action valida de novo no servidor - isso
// aqui e so pra nao mostrar botao que vai dar erro.
const ALLOWED_BY_ROLE: Record<string, ServiceOrderStatus[]> = {
  manager: ["agendada", "em_execucao", "concluida", "conferida", "faturada", "cancelada", "remarcada", "assistencia"],
  reviewer: ["conferida", "faturada"],
  technician: ["em_execucao", "concluida"],
};

export function StatusActions({
  serviceOrderId,
  status,
  canManage,
  canReview,
  canReopen,
  isTechnician,
}: {
  serviceOrderId: string;
  status: ServiceOrderStatus;
  canManage: boolean;
  canReview: boolean;
  canReopen: boolean;
  isTechnician: boolean;
}) {
  const [pending, start] = useTransition();

  const allowed = new Set<ServiceOrderStatus>([
    ...(canManage ? ALLOWED_BY_ROLE.manager : []),
    ...(canReview ? ALLOWED_BY_ROLE.reviewer : []),
    ...(isTechnician ? ALLOWED_BY_ROLE.technician : []),
  ]);

  const options = nextServiceOrderStatuses(status).filter((next) => {
    if (!allowed.has(next)) return false;
    // Conferencia e faturamento so aparecem pra quem pode de fato aprovar.
    if ((next === "conferida" || next === "faturada") && !canReview) return false;
    const reopening =
      (status === "concluida" && next === "em_execucao") ||
      (status === "conferida" && next === "concluida") ||
      (status === "assistencia" && next === "em_execucao");
    if (reopening && !canReopen) return false;
    return true;
  });

  const canCancelClosure =
    canReopen && ["concluida", "conferida", "assistencia"].includes(status);

  if (options.length === 0 && !canCancelClosure) return null;

  // O confirmDialog fica FORA da transicao de proposito: ele abre o dialogo
  // por setState, e dentro de start() esse setState entra na propria
  // transicao - que so termina quando a promise resolve, e a promise so
  // resolve quando o usuario clica no dialogo que nunca foi renderizado.
  // Dentro da transicao isso travava em silencio, sem dialogo e sem acao.
  async function move(to: ServiceOrderStatus) {
    let reason: string | undefined;
    const needsReason =
      to === "remarcada" ||
      (status === "concluida" && to === "em_execucao") ||
      (status === "conferida" && to === "concluida") ||
      (status === "assistencia" && to === "em_execucao");

    if (needsReason) {
      const label = to === "remarcada" ? "remarcação" : "reabertura";
      const value = window.prompt(`Informe o motivo da ${label}:`)?.trim();
      if (!value) return;
      reason = value;
    }

    if (to === "cancelada") {
      const confirmed = await confirmDialog({
        title: "Cancelar esta OS?",
        description: "Uma OS cancelada não pode ser reaberta.",
        confirmLabel: "Cancelar OS",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    if (to === "faturada") {
      // Mostra pra quem vai o dinheiro ANTES de gerar - faturar sem essa
      // tela foi como uma comissao saiu sem ninguem esperar.
      let lines: Awaited<ReturnType<typeof previewServiceOrderCommissions>> = [];
      try {
        lines = await previewServiceOrderCommissions(serviceOrderId);
      } catch (error) {
        notifyError(error, "Não foi possível calcular as comissões");
        return;
      }

      const description =
        lines.length === 0
          ? "Nenhuma comissão será gerada nesta OS."
          : lines
              .map(
                (l) =>
                  `${COMMISSION_PARTY_LABEL[l.partyKind]}${l.partnerName ? ` (${l.partnerName})` : ""}: ${formatCurrencyBRL(l.amountCents)}`,
              )
              .join("\n");

      const confirmed = await confirmDialog({
        title: "Faturar esta OS?",
        description,
        confirmLabel: "Faturar",
      });
      if (!confirmed) return;
    }

    start(async () => {
      try {
        await transitionServiceOrder({ id: serviceOrderId, to, reason });
        notify({ title: `OS marcada como ${SERVICE_ORDER_STATUS_LABEL[to].toLowerCase()}`, tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível mudar o status");
      }
    });
  }

  async function cancelClosure() {
    const reason = window.prompt("Informe o motivo do cancelamento da finalização:")?.trim();
    if (!reason) return;
    const confirmed = await confirmDialog({
      title: "Cancelar esta finalização?",
      description:
        "A OS volta para Em execução. O laudo permanece no histórico e um novo fechamento poderá ser feito.",
      confirmLabel: "Cancelar finalização",
      tone: "danger",
    });
    if (!confirmed) return;

    start(async () => {
      try {
        await cancelServiceOrderClosure({ id: serviceOrderId, reason });
        notify({ title: "Finalização cancelada", tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível cancelar a finalização");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((next) => (
        <Button
          key={next}
          type="button"
          size="sm"
          variant={next === "cancelada" ? "outline" : "brand"}
          disabled={pending}
          onClick={() => move(next)}
        >
          {SERVICE_ORDER_STATUS_LABEL[next]}
        </Button>
      ))}
      {canCancelClosure && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={cancelClosure}
        >
          Cancelar finalização
        </Button>
      )}
    </div>
  );
}
