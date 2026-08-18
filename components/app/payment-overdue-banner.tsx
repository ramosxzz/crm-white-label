import { AlertOctagon } from "lucide-react";

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

/** Aviso de fatura vencida - nao tem botao de fechar de proposito: fica
 * visivel ate o pagamento ser regularizado, o cliente precisa ver toda vez. */
export function PaymentOverdueBanner({ dueAt }: { dueAt: string | null }) {
  return (
    <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/15 px-4 py-2 text-sm text-red-900 dark:text-red-200">
      <AlertOctagon className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      <span>
        <strong>Pagamento pendente{dueAt ? ` desde ${formatDateBR(dueAt)}` : ""}.</strong>{" "}
        Regularize a assinatura o quanto antes — sem o pagamento, o sistema entrará em standby e o acesso será suspenso.
      </span>
    </div>
  );
}
