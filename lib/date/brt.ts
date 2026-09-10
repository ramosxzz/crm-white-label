/** Início e fim do dia civil em Brasília (America/Sao_Paulo). */
export function getBRTDayBounds(date = new Date()) {
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const start = new Date(`${dateStr}T00:00:00-03:00`);
  const end = new Date(`${dateStr}T23:59:59.999-03:00`);
  return { dateStr, startIso: start.toISOString(), endIso: end.toISOString() };
}

export function getBRTYesterdayBounds(date = new Date()) {
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  return getBRTDayBounds(yesterday);
}

export function getBRTDayBoundsFromDateString(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const start = new Date(`${dateStr}T00:00:00-03:00`);
  const end = new Date(`${dateStr}T23:59:59.999-03:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return { dateStr, startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Início e fim do mês civil em Brasília. offset=0 é o mês atual, -1 o anterior. */
export function getBRTMonthBounds(offset = 0, date = new Date()) {
  const dateStr = date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [year, month] = dateStr.split("-").map(Number);

  // Mes de JS e 0-indexado; ao somar/subtrair offset direto no construtor,
  // ele normaliza ano e mes sozinho (mes -1 de janeiro vira dezembro do ano
  // anterior).
  const start = new Date(Date.UTC(year, month - 1 + offset, 1));
  const end = new Date(Date.UTC(year, month + offset, 1));

  const pad = (n: number) => String(n).padStart(2, "0");
  const startStr = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-01`;

  return {
    dateStr: startStr,
    startIso: new Date(`${startStr}T00:00:00-03:00`).toISOString(),
    endIso: new Date(`${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-01T00:00:00-03:00`).toISOString(),
  };
}

export function getBRTRollingDayBounds(days: number, date = new Date()) {
  const safeDays = Math.max(1, Math.floor(days));
  const today = getBRTDayBounds(date);
  const start = new Date(today.startIso);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));

  return {
    dateStr: today.dateStr,
    startIso: start.toISOString(),
    endIso: today.endIso,
  };
}

export function formatBRTDateLong(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatBRTTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBRTDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** "05/08 14:30" - usado em banners de agendamento, historico de ligacoes etc. */
export function formatBRTDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "05/08/2026" - data completa com ano, sem hora. */
export function formatBRTFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "05/08/2026 14:30" - data completa + hora. */
export function formatBRTFullDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "32min" / "4h" / "1d" - versao ainda mais compacta pra lista de conversas
 * (coluna estreita, um item por linha). Sem "ha", sem "cerca de" (era o que
 * o date-fns/ptBR gerava antes - "cerca de 16 horas" nao cabe numa coluna
 * de 360px sem truncar o preview da mensagem do lado).
 */
export function formatCompactTimeBRT(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}sem`;
  return formatBRTDateShort(iso);
}

/**
 * "há 5 min" / "há 2 h" / "há 3 dias" - pra achar de relance lead parado ha
 * tempo, sem precisar ler data/hora e fazer conta de cabeca. Passa a usar
 * data completa (formatBRTFullDateTime) a partir de 30 dias, onde "ha X dias"
 * deixa de ser util.
 */
export function formatRelativeTimeBRT(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} dia${days === 1 ? "" : "s"}`;
  return formatBRTFullDate(iso);
}
