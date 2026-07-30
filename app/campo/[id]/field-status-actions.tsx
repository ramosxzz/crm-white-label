"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { queueMutation } from "@/lib/field-service/offline";
import { notify, notifyError } from "@/lib/ui/feedback";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { syncNow } from "../sync";

/**
 * Em campo o tecnico so inicia a visita aqui. O fechamento completo fica no
 * laudo; remarcacao e responsabilidade do escritorio.
 */
export function FieldStatusActions({
  serviceOrderId,
  status,
}: {
  serviceOrderId: string;
  status: ServiceOrderStatus;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function move(to: "em_execucao" | "concluida", reason?: string) {
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

  return null;
}
