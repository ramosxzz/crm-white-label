/**
 * Janela de horario em que a automacao pode mandar mensagem.
 *
 * Cadencia automatica sem isso manda no meio da madrugada: os intervalos sao
 * contados a partir da entrada do lead, entao quem se cadastra as 22h receberia
 * a mensagem seguinte a 1h. Fora de hora nao e so incomodo - e denuncia e
 * bloqueio do numero no WhatsApp, que derruba o atendimento inteiro.
 *
 * Fora da janela a mensagem NAO e descartada: o passo fica esperando e sai na
 * proxima abertura. Descartar perderia um contato da cadencia em silencio.
 *
 * Tudo em horario de Brasilia, decidido no servidor.
 */

export const DEFAULT_SEND_START_HOUR = 8;
export const DEFAULT_SEND_END_HOUR = 21;

/** Hora do dia em Brasilia, independente do fuso de quem chamou. */
export function brtHour(date: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
  }).format(date);
  // Meia-noite volta como "24" em algumas engines.
  return Number(hour) % 24;
}

export function isWithinSendingWindow(
  date: Date = new Date(),
  startHour: number = DEFAULT_SEND_START_HOUR,
  endHour: number = DEFAULT_SEND_END_HOUR,
): boolean {
  const hour = brtHour(date);
  // 21h é o fechamento: às 21h00 já não sai (a última mensagem sai até 20h59).
  return hour >= startHour && hour < endHour;
}

/**
 * Proxima abertura da janela, a partir de `from`.
 *
 * Antes de abrir, e hoje mesmo; depois de fechar, e amanha. Avanca de hora em
 * hora e confere pelo relogio de Brasilia em vez de somar offset na mao -
 * assim horario de verao (se voltar) nao desloca a janela.
 */
export function nextWindowOpening(
  from: Date = new Date(),
  startHour: number = DEFAULT_SEND_START_HOUR,
  endHour: number = DEFAULT_SEND_END_HOUR,
): Date {
  const cursor = new Date(from.getTime());
  // Zera minutos/segundos pra abrir cravado na hora cheia.
  cursor.setUTCMinutes(0, 0, 0);

  // 48 passos cobrem dois dias inteiros - suficiente pra qualquer janela valida.
  for (let i = 0; i <= 48; i++) {
    if (cursor.getTime() >= from.getTime() && isWithinSendingWindow(cursor, startHour, endHour)) {
      return cursor;
    }
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  // Janela invalida (ex: start >= end): nao segura a mensagem pra sempre.
  return from;
}

/**
 * Quando este envio pode acontecer: agora, ou a proxima abertura.
 * Devolve null quando pode sair na hora.
 */
export function deferUntil(
  now: Date = new Date(),
  startHour: number = DEFAULT_SEND_START_HOUR,
  endHour: number = DEFAULT_SEND_END_HOUR,
): Date | null {
  if (startHour >= endHour) return null; // configuracao sem sentido: nao segura
  if (isWithinSendingWindow(now, startHour, endHour)) return null;
  return nextWindowOpening(now, startHour, endHour);
}
