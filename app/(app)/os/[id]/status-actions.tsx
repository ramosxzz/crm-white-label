"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import {
  SERVICE_ORDER_STATUS_LABEL,
  nextServiceOrderStatuses,
} from "@/lib/field-service/status";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { transitionServiceOrder } from "../actions";

// O que cada papel pode disparar. A action valida de novo no servidor - isso
// aqui e so pra nao mostrar botao que vai dar erro.
const ALLOWED_BY_ROLE: Record<string, ServiceOrderStatus[]> = {
  manager: ["agendada", "em_execucao", "concluida", "conferida", "faturada", "cancelada", "remarcada"],
  reviewer: ["conferida", "faturada"],
  technician: ["em_execucao", "concluida", "remarcada"],
};

export function StatusActions({
  serviceOrderId,
  status,
  canManage,
  canReview,
  isTechnician,
}: {
  serviceOrderId: string;
  status: ServiceOrderStatus;
  canManage: boolean;
  canReview: boolean;
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
    return true;
  });

  if (options.length === 0) return null;

  function move(to: ServiceOrderStatus) {
    start(async () => {
      if (to === "cancelada") {
        const confirmed = await confirmDialog({
          title: "Cancelar esta OS?",
          description: "Uma OS cancelada não pode ser reaberta.",
          confirmLabel: "Cancelar OS",
          tone: "danger",
        });
        if (!confirmed) return;
      }
      try {
        await transitionServiceOrder({ id: serviceOrderId, to });
        notify({ title: `OS marcada como ${SERVICE_ORDER_STATUS_LABEL[to].toLowerCase()}`, tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível mudar o status");
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
    </div>
  );
}
