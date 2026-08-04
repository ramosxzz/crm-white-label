const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

export type CsvFieldMapping = {
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
};

const HEURISTIC_ALIASES: Record<keyof CsvFieldMapping, string[]> = {
  name: ["name", "nome", "nome completo", "cliente", "lead"],
  phone: ["phone", "telefone", "celular", "whatsapp", "fone", "numero", "número"],
  email: ["email", "e-mail"],
  source: ["source", "origem", "canal"],
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Sem IA (chave nao configurada, ou a chamada falhou): tenta bater o
 * cabecalho com os nomes mais comuns em portugues/ingles. */
export function heuristicCsvMapping(headers: string[]): CsvFieldMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: CsvFieldMapping = { name: null, phone: null, email: null, source: null };
  for (const field of Object.keys(HEURISTIC_ALIASES) as (keyof CsvFieldMapping)[]) {
    const match = normalized.find((h) => HEURISTIC_ALIASES[field].includes(h.norm));
    mapping[field] = match?.raw ?? null;
  }
  return mapping;
}

/** Pede pra IA mapear os cabecalhos da planilha (em qualquer idioma/ordem/
 * nome) pros 4 campos que o CRM entende. So manda o cabecalho + 2 linhas de
 * exemplo - nunca a planilha inteira (rapido e barato, funciona pra
 * qualquer tamanho de arquivo). Cai pra heuristica se a IA nao estiver
 * configurada ou falhar. */
export async function suggestCsvMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<CsvFieldMapping> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || headers.length === 0) return heuristicCsvMapping(headers);

  const baseUrl = (process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const prompt = [
    "Voce recebe o cabecalho de uma planilha de leads (em qualquer idioma, ordem ou nomenclatura) e algumas linhas de exemplo.",
    "Responda APENAS um JSON valido, sem nenhum texto antes ou depois, no formato:",
    '{"name": "<cabecalho exato para o nome do lead ou null>", "phone": "<cabecalho exato para telefone/whatsapp ou null>", "email": "<cabecalho exato para email ou null>", "source": "<cabecalho exato para origem/canal ou null>"}',
    "Cada valor deve ser exatamente um dos cabecalhos recebidos (copiado igual, sem alterar) ou null se nao houver coluna correspondente.",
    "",
    `Cabecalhos: ${JSON.stringify(headers)}`,
    `Exemplos de linhas: ${JSON.stringify(sampleRows.slice(0, 3))}`,
  ].join("\n");

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 300,
      }),
    });
    if (!resp.ok) return heuristicCsvMapping(headers);
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return heuristicCsvMapping(headers);
    const parsed = JSON.parse(jsonMatch[0]) as Partial<CsvFieldMapping>;

    const headerSet = new Set(headers);
    const mapping: CsvFieldMapping = { name: null, phone: null, email: null, source: null };
    for (const field of Object.keys(mapping) as (keyof CsvFieldMapping)[]) {
      const value = parsed[field];
      mapping[field] = typeof value === "string" && headerSet.has(value) ? value : null;
    }
    // Se a IA nao achou nem o nome, provavelmente devolveu algo inutil -
    // melhor cair pra heuristica do que importar tudo sem nome.
    if (!mapping.name) return heuristicCsvMapping(headers);
    return mapping;
  } catch {
    return heuristicCsvMapping(headers);
  }
}
