"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mantem as telas de OS atualizadas sem F5.
 *
 * As telas do escritorio sao renderizadas no servidor: quando o tecnico
 * concluia a OS no app de campo, a aba que ja estava aberta continuava
 * mostrando o estado antigo ate alguem recarregar. Aqui a gente escuta a
 * tabela e pede pro Next buscar os dados de novo.
 *
 * `router.refresh()` refaz so o lado servidor da rota atual: nao pisca a tela,
 * nao perde scroll e nao perde filtro selecionado.
 */
export function ServiceOrdersLive({
  tenantId,
  withTechnicianPositions = false,
}: {
  tenantId: string;
  /** Só o mapa precisa: escutar posição nas outras telas seria refresh à toa. */
  withTechnicianPositions?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Faturar mexe em varias linhas de uma vez; sem esse respiro seriam
    // varios refresh seguidos pra uma acao so.
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    let channel = supabase.channel(`service-orders-${tenantId}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "service_orders",
        filter: `tenant_id=eq.${tenantId}`,
      },
      refreshSoon,
    );

    if (withTechnicianPositions) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "technician_locations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        refreshSoon,
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tenantId, router, withTechnicianPositions]);

  return null;
}
