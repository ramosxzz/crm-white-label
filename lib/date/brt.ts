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
