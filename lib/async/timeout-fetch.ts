/** Preserva cancelamento do chamador e limita a espera pela resposta. */
export function createTimeoutFetch(timeoutMs: number, fetcher: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    return fetcher(input, {
      ...init,
      signal: callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal,
    });
  };
}
