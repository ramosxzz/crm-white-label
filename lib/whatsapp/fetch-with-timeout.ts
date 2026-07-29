/**
 * `fetch` nativo nao tem timeout por padrao: um provedor de WhatsApp que
 * trava (Evolution, Z-API, Cloud API) deixava a Server Action de envio
 * pendurada indefinidamente, e o usuario via "enviando" parado por minutos
 * sem nenhum erro - so descobria que nao foi quando desistia e recarregava.
 *
 * Envio de midia entrega tempo maior que texto porque o provedor baixa o
 * arquivo da nossa URL e so depois repassa pro WhatsApp.
 */
export const PROVIDER_TIMEOUT_TEXT_MS = 45_000;
export const PROVIDER_TIMEOUT_MEDIA_MS = 90_000;

export class ProviderTimeoutError extends Error {
  constructor(providerLabel: string, timeoutMs: number) {
    super(`${providerLabel} não respondeu em ${Math.round(timeoutMs / 1000)}s. Tente novamente.`);
    this.name = "ProviderTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  providerLabel: string,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new ProviderTimeoutError(providerLabel, timeoutMs);
    }
    throw error;
  }
}
