"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mesma ideia do ServiceOrdersLive do escritorio (app/(app)/os/service-orders-live.tsx),
 * so que focada na OS que o tecnico ta vendo: quando o ADM aprova um upsell
 * ou muda algo na OS pelo computador, o celular do tecnico atualiza sozinho,
 * sem precisar sair e voltar na tela.
 */
export function OrderLive({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    const channel = supabase
      .channel(`campo-order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders", filter: `id=eq.${orderId}` },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_order_items", filter: `service_order_id=eq.${orderId}` },
        refreshSoon,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [orderId, router]);

  return null;
}
