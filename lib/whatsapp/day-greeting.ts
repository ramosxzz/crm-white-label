/** Saudação de acordo com o horário em Brasília: usada em mensagens que
 * disparam em momentos variados do dia (cadência de renovação/cobrança). */
export function dayGreeting(date: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(date),
  ) % 24;
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}
