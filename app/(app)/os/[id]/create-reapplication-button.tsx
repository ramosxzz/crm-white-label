"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmDialog, notifyError } from "@/lib/ui/feedback";
import { createReapplicationServiceOrder } from "../actions";

export function CreateReapplicationButton({ originServiceOrderId }: { originServiceOrderId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onClick() {
    const confirmed = await confirmDialog({
      title: "Criar reaplicação?",
      description:
        "Abre uma OS nova, ligada a esta como origem, com o mesmo cliente/endereço/parceiro. Os itens são copiados como ponto de partida.",
      confirmLabel: "Criar reaplicação",
    });
    if (!confirmed) return;
    start(async () => {
      try {
        const id = await createReapplicationServiceOrder({ originServiceOrderId });
        router.push(`/os/${id}`);
      } catch (error) {
        notifyError(error, "Não foi possível criar a reaplicação");
      }
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClick}>
      <RefreshCcw className="h-3.5 w-3.5" /> Reaplicação
    </Button>
  );
}
