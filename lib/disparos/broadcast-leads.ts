export type BroadcastLead = {
  id: string;
  name: string;
  phone: string | null;
  source: string | null;
  created_at: string;
};

export type BroadcastLeadPeriod = "all" | "latest_import" | "today" | "7d" | "30d";

function saoPauloDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function hasContactName(lead: Pick<BroadcastLead, "name" | "phone">): boolean {
  const name = lead.name.trim();
  if (!name || !/[A-Za-zÀ-ÿ]/.test(name)) return false;
  const nameDigits = name.replace(/\D/g, "");
  const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  return !nameDigits || nameDigits !== phoneDigits;
}

export function formatBroadcastPhone(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "Sem telefone";
  if (digits.startsWith("55") && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.startsWith("55") && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits}`;
}

/**
 * Inserts em lote recebem o mesmo created_at no Postgres. O agrupamento
 * permite recuperar a ultima importacao mesmo para planilhas anteriores a
 * existencia de um identificador explicito de lote.
 */
export function latestImportTimestamp(leads: BroadcastLead[]): string | null {
  const counts = new Map<string, number>();
  for (const lead of leads) counts.set(lead.created_at, (counts.get(lead.created_at) ?? 0) + 1);

  let latest: string | null = null;
  for (const [createdAt, count] of counts) {
    if (count < 2) continue;
    if (!latest || new Date(createdAt).getTime() > new Date(latest).getTime()) latest = createdAt;
  }
  return latest;
}

export function filterBroadcastLeads(
  leads: BroadcastLead[],
  filters: {
    search: string;
    source: string;
    period: BroadcastLeadPeriod;
    now?: Date;
    latestImport?: string | null;
  },
): BroadcastLead[] {
  const query = filters.search.trim().toLocaleLowerCase("pt-BR");
  const now = filters.now ?? new Date();
  const today = saoPauloDateKey(now);
  const latestImport = filters.latestImport ?? latestImportTimestamp(leads);
  const periodDays = filters.period === "7d" ? 7 : filters.period === "30d" ? 30 : null;
  const minimumTime = periodDays ? now.getTime() - periodDays * 24 * 60 * 60 * 1000 : null;

  return leads.filter((lead) => {
    if (query) {
      const haystack = `${lead.name} ${lead.phone ?? ""} ${lead.source ?? ""}`.toLocaleLowerCase("pt-BR");
      if (!haystack.includes(query)) return false;
    }
    if (filters.source !== "all" && lead.source !== filters.source) return false;
    if (filters.period === "latest_import" && (!latestImport || lead.created_at !== latestImport)) return false;
    if (filters.period === "today" && saoPauloDateKey(new Date(lead.created_at)) !== today) return false;
    if (minimumTime !== null && new Date(lead.created_at).getTime() < minimumTime) return false;
    return true;
  });
}
