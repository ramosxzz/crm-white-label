// Ligacoes com poucos segundos de duracao geralmente sao a pessoa atendendo e
// desligando na hora (ou caixa postal pegando rapido) - nao conta como
// atendimento de verdade pro time.
export const ANSWERED_MIN_SECONDS = 10;

export function isCallAnswered(durationSeconds: number): boolean {
  return durationSeconds >= ANSWERED_MIN_SECONDS;
}
