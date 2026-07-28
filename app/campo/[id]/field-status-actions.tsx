"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX, CheckCircle2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queueMutation } from "@/lib/field-service/offline";
import { confirmDialog, notify, notifyError } from "@/lib/ui/feedback";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { syncNow } from "../sync";

/**
 * Botoes de campo. Conjunto fechado: iniciar, concluir e remarcar. Conferir
 * e faturar continuam sendo do escritorio.
 */
export function FieldStatusActions({
  serviceOrderId,
  status,
  hasSignature,
}: {
  serviceOrderId: string;
  status: ServiceOrderStatus;
  hasSignature: boolean;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function move(to: "em_execucao" | "concluida" | "remarcada", reason?: string) {
    setPending(true);
    try {
      await queueMutation({
        kind: "status",
        serviceOrderId,
        payload: { to, reason },
      });

      if (navigator.onLine) {
        const outcome = await syncNow();
        if (outcome.failed.length > 0) throw new Error(outcome.failed[0].error);
        notify({ title: "Atualizado", tone: "success" });
        router.refresh();
      } else {
        notify({
          title: "Guardado no celular",
          description: "Sobe sozinho quando a internet voltar.",
          tone: "info",
        });
      }
    } catch (error) {
      notifyError(error, "Não foi possível atualizar a OS");
    } finally {
      setPending(false);
    }
  }

  async function reschedule() {
    const confirmed = await confirmDialog({
      title: "Remarcar essa visita?",
      description: "A OS volta pra fila do escritório e sai do seu roteiro de hoje.",
      confirmLabel: "Remarcar",
    });
    if (!confirmed) return;
    await move("remarcada", "Remarcada em campo");
  }

  if (status === "agendada" || status === "remarcada") {
    return (
      <Button
        type="button"
        variant="brand"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() => move("em_execucao")}
      >
        <Play className="h-4 w-4" /> Cheguei — iniciar
      </Button>
    );
  }

  if (status === "em_execucao") {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={pending || !hasSignature}
          onClick={() => move("concluida")}
        >
          <CheckCircle2 className="h-4 w-4" /> Concluir serviço
        </Button>
        {!hasSignature && (
          <p className="text-center text-xs text-muted-foreground">
            Colete a assinatura do cliente pra liberar a conclusão.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={reschedule}
        >
          <CalendarX className="h-4 w-4" /> Cliente ausente / remarcar
        </Button>
      </div>
    );
  }

  return null;
}
