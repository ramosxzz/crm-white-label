"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CalendarClock, CheckCircle2, MoreHorizontal, Printer, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ServiceOrderStatus } from "@/lib/supabase/database.types";
import { notify, notifyError, unwrapAction } from "@/lib/ui/feedback";
import { confirmServiceOrder, transitionServiceOrder, unconfirmServiceOrder } from "./actions";

export function OsRowActions({
  id,
  status,
  confirmed,
  canManage,
}: {
  id: string;
  status: ServiceOrderStatus;
  confirmed: boolean;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const terminal = status === "faturada" || status === "cancelada";

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        notify({ title: success, tone: "success" });
      } catch (error) {
        notifyError(error, "Não foi possível concluir a ação");
      }
    });
  }

  function transition(to: ServiceOrderStatus, label: string) {
    const reason = window.prompt(`Motivo para ${label.toLowerCase()}:`);
    if (!reason) return;
    run(() => unwrapAction(transitionServiceOrder({ id, to, reason })), label);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label="Ações da OS">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/os/${id}`}>Abrir OS completa</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/os/${id}/print`}><Printer className="h-4 w-4" /> Imprimir ficha</Link>
        </DropdownMenuItem>
        {canManage && !terminal && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => run(
                () => unwrapAction(confirmed ? unconfirmServiceOrder({ id }) : confirmServiceOrder({ id })),
                confirmed ? "Confirmação removida" : "OS confirmada",
              )}
            >
              <CheckCircle2 className="h-4 w-4" /> {confirmed ? "Remover confirmação" : "Confirmar com cliente"}
            </DropdownMenuItem>
            {status !== "remarcada" && (
              <DropdownMenuItem onSelect={() => transition("remarcada", "OS movida para remarcar")}>
                <CalendarClock className="h-4 w-4" /> Remarcar
              </DropdownMenuItem>
            )}
            {["concluida", "conferida"].includes(status) && (
              <DropdownMenuItem onSelect={() => transition("em_execucao", "OS reaberta")}>
                <RotateCcw className="h-4 w-4" /> Reabrir
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => transition("cancelada", "OS cancelada")}>
              <XCircle className="h-4 w-4" /> Cancelar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
