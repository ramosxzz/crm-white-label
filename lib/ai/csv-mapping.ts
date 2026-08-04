import {
  heuristicCsvMapping,
  isReliableCsvMapping,
  type CsvFieldMapping,
} from "@/lib/leads/spreadsheet-mapping";

export type { CsvFieldMapping } from "@/lib/leads/spreadsheet-mapping";

const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";
const AI_MAPPING_TIMEOUT_MS = 6_000;

/** Pede pra IA mapear os cabecalhos da planilha (em qualquer idioma/ordem/
 * nome) pros 4 campos que o CRM entende. So manda o cabecalho + 2 linhas de
 * exemplo - nunca a planilha inteira (rapido e barato, funciona pra
 * qualquer tamanho de arquivo). Cai pra heuristica se a IA nao estiver
 * configurada ou falhar. */
export async function suggestCsvMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<CsvFieldMapping> {
  const heuristic = heuristicCsvMapping(headers);
  if (isReliableCsvMapping(heuristic)) return heuristic;

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || headers.length === 0) return heuristic;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_MAPPING_TIMEOUT_MS);

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
      signal: controller.signal,
    });
    if (!resp.ok) return heuristic;
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return heuristic;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<CsvFieldMapping>;

    const headerSet = new Set(headers);
    const mapping: CsvFieldMapping = { name: null, phone: null, email: null, source: null };
    for (const field of Object.keys(mapping) as (keyof CsvFieldMapping)[]) {
      const value = parsed[field];
      const aiValue = typeof value === "string" && headerSet.has(value) ? value : null;
      mapping[field] = heuristic[field] ?? aiValue;
    }
    // Se a IA nao achou nem o nome, provavelmente devolveu algo inutil -
    // melhor cair pra heuristica do que importar tudo sem nome.
    if (!mapping.name) return heuristic;
    return mapping;
  } catch {
    return heuristic;
  } finally {
    clearTimeout(timeout);
  }
}
