/**
 * Janela em que a posicao do tecnico pode ser compartilhada.
 *
 * Rastrear funcionario tem limite: precisa ser comunicado, ter finalidade
 * clara e ficar restrito ao horario de trabalho. Fora da janela o
 * compartilhamento para sozinho - nao depende do tecnico lembrar de desligar,
 * nem da empresa lembrar de nao olhar.
 *
 * A checagem roda nos dois lados: o app do tecnico para de enviar, e a server
 * action recusa o que chegar fora do horario. Cliente pode ter relogio errado
 * ou ser burlado; o servidor e quem decide.
 */
export const TRACKING_START_HOUR = 6;
export const TRACKING_END_HOUR = 20;

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

export function isWithinTrackingWindow(date: Date = new Date()): boolean {
  const hour = brtHour(date);
  return hour >= TRACKING_START_HOUR && hour < TRACKING_END_HOUR;
}

/** Texto mostrado pro tecnico, pra ele saber exatamente o combinado. */
export const TRACKING_WINDOW_LABEL = `das ${TRACKING_START_HOUR}h às ${TRACKING_END_HOUR}h`;

/**
 * Depois de quanto tempo uma posicao para de valer como "ao vivo".
 * Passou disso, a tela mostra como desatualizada em vez de fingir que o
 * tecnico ainda esta la.
 */
export const POSITION_STALE_MS = 10 * 60 * 1000;

export function isPositionFresh(recordedAt: string | Date, now: Date = new Date()): boolean {
  const at = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
  if (Number.isNaN(at.getTime())) return false;
  return now.getTime() - at.getTime() < POSITION_STALE_MS;
}
