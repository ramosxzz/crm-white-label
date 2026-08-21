"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify, notifyError } from "@/lib/ui/feedback";
import { assignFolderLead, type SellerOption } from "./actions";

/** Distribuicao da pasta pra vendedora - so a gestao (Michele) ve isso. */
export function AssignLead({
  leadId,
  currentSellerId,
  sellers,
}: {
  leadId: string;
  currentSellerId: string | null;
  sellers: SellerOption[];
}) {
  const [pending, start] = useTransition();

  function assign(value: string) {
    const sellerId = value === "none" ? null : value;
    start(async () => {
      try {
        await assignFolderLead({ leadId, sellerId });
        notify({
          title: sellerId ? "Lead distribuído" : "Lead devolvido pra fila da pasta",
          tone: "success",
        });
      } catch (err) {
        notifyError(err, "Não foi possível distribuir o lead");
      }
    });
  }

  return (
    <Select value={currentSellerId ?? "none"} onValueChange={assign} disabled={pending}>
      <SelectTrigger className="h-8 w-44 text-xs" onClick={(e) => e.stopPropagation()}>
        <SelectValue placeholder="Distribuir" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Na fila (sem dono)</SelectItem>
        {sellers.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
