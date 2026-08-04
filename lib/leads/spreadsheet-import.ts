import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

export type SpreadsheetLeadInput = {
  name: string;
  phone?: string;
  email?: string;
  source?: string;
};

export type PreparedSpreadsheetLead = {
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
};

/**
 * Limpa os dados antes do insert e remove telefones repetidos dentro do
 * proprio arquivo. Telefone preenchido mas invalido vira null; nunca salva
 * string vazia, que colidiria no indice unico do tenant.
 */
export function prepareSpreadsheetLeads(rows: SpreadsheetLeadInput[]): {
  rows: PreparedSpreadsheetLead[];
  skippedDuplicates: number;
  invalidPhones: number;
} {
  const seenPhones = new Set<string>();
  const prepared: PreparedSpreadsheetLead[] = [];
  let skippedDuplicates = 0;
  let invalidPhones = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;

    const rawPhone = row.phone?.trim() ?? "";
    const phone = rawPhone ? normalizeWhatsAppPhone(rawPhone) : "";
    if (rawPhone && !phone) invalidPhones++;

    if (phone && seenPhones.has(phone)) {
      skippedDuplicates++;
      continue;
    }
    if (phone) seenPhones.add(phone);

    prepared.push({
      name,
      phone: phone || null,
      email: row.email?.trim() || null,
      source: row.source?.trim() || null,
    });
  }

  return { rows: prepared, skippedDuplicates, invalidPhones };
}

export function isDuplicateLeadPhoneError(error: { code?: string; message?: string } | null): boolean {
  return Boolean(
    error?.code === "23505" && error.message?.includes("leads_tenant_phone_unique"),
  );
}
