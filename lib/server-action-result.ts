import { unstable_rethrow } from "next/navigation";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Next.js apaga a mensagem de qualquer erro lancado dentro de uma Server
 * Action em producao - vira sempre "An error occurred in the Server
 * Components render...", sem dizer o motivo real (nem pra validacao normal,
 * tipo "valor negociado nao pode ser maior que a tabela"). Ja confundiu
 * usuario e cliente varias vezes, parecendo bug/travamento quando nao era.
 *
 * Envolvendo a action aqui, o erro e capturado no servidor e devolvido como
 * dado comum (nao como excecao) - so assim a mensagem sobrevive ate o
 * cliente. Ver unwrapAction em lib/ui/feedback.ts, que reconstroi o throw
 * no navegador (onde a mensagem nao e redigida).
 */
export function safeAction<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>) {
  return async (...args: Args): Promise<ActionResult<T>> => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (err) {
      unstable_rethrow(err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Não foi possível concluir a ação.",
      };
    }
  };
}
