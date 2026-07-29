export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Promise.race com um timeout que rejeita com mensagem clara.
 *
 * Nao cancela o trabalho de verdade (upload de arquivo via fetch nao expoe
 * jeito limpo de abortar aqui) - so garante que quem esta esperando nunca
 * fica esperando pra sempre. Uma tela que "trava" porque uma promise nunca
 * resolve nem rejeita e pior que uma que falha com erro explicado.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
