import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * `fetch` nativo nao tem timeout por padrao: sem isso, uma chamada ao
 * Supabase (query, storage upload) que trava por sinal fraco - comum no
 * tecnico em campo - deixa a Promise pendurada pra sempre. Como ela nunca
 * chega a rejeitar, nenhum error boundary ou toast de erro dispara: a tela
 * so "trava" ate o usuario dar F5. 30s cobre upload de foto/assinatura em
 * conexao ruim sem deixar uma query normal esperando o dia inteiro.
 */
const SUPABASE_FETCH_TIMEOUT_MS = 30_000;

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS) });
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: timeoutFetch } },
  );
}
