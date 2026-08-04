export type CsvFieldMapping = {
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
};

const HEURISTIC_ALIASES: Record<keyof CsvFieldMapping, string[]> = {
  name: [
    "name",
    "full name",
    "nome",
    "nome completo",
    "nome cliente",
    "nome do cliente",
    "cliente",
    "lead",
  ],
  phone: [
    "phone",
    "phone number",
    "mobile",
    "telefone",
    "telefone 1",
    "telefone principal",
    "telefone cliente",
    "celular",
    "cel",
    "whatsapp",
    "whats",
    "zap",
    "fone",
    "numero",
  ],
  email: ["email", "e mail", "email cliente", "email do cliente"],
  source: ["source", "origem", "origem lead", "origem do lead", "canal", "campanha"],
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Mapeamento instantaneo para os cabecalhos mais comuns. Pode rodar no
 * navegador e evita chamar IA para planilhas que ja sao autoexplicativas. */
export function heuristicCsvMapping(headers: string[]): CsvFieldMapping {
  const normalized = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  const mapping: CsvFieldMapping = { name: null, phone: null, email: null, source: null };

  for (const field of Object.keys(HEURISTIC_ALIASES) as (keyof CsvFieldMapping)[]) {
    const match = normalized.find(({ normalized: value }) => HEURISTIC_ALIASES[field].includes(value));
    mapping[field] = match?.raw ?? null;
  }

  return mapping;
}

/** Nome + um meio de contato ja tornam o mapeamento seguro. Origem e opcional. */
export function isReliableCsvMapping(mapping: CsvFieldMapping): boolean {
  return Boolean(mapping.name && (mapping.phone || mapping.email));
}
