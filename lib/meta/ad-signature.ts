/**
 * Identifica de qual criativo veio um lead pela "assinatura" da primeira
 * mensagem.
 *
 * Por que isso existe: quem usa Evolution API nao recebe o referral do
 * Click-to-WhatsApp, entao nao da pra saber o anuncio de origem pelo caminho
 * normal. Na pratica o time de trafego coloca um emoji distinto no texto de
 * abertura de cada criativo, e e esse emoji que carrega a informacao.
 *
 * As funcoes aqui sao puras de proposito: e a parte que decide a atribuicao de
 * receita a anuncio, entao precisa ser testavel sem banco.
 */

export type AdCreativeSignature = {
  id: string;
  emoji: string;
  matchText: string | null;
  creativeName: string;
  adId: string | null;
  active: boolean;
};

/**
 * Textos que o proprio CRM grava no lugar da mensagem quando o conteudo e
 * midia. Eles comecam com emoji e cairiam na deteccao como se fossem criativo.
 *
 * Nao e hipotetico: o marcador de localizacao usa o mesmo pin que ja e o emoji
 * de um criativo em producao. Sem esta guarda, todo cliente que mandasse a
 * localizacao viraria venda atribuida aquele anuncio.
 */
const MEDIA_PLACEHOLDERS = [
  "🎤 Áudio",
  "🎬 Vídeo",
  "🎭 Figurinha",
  "👤 Contato",
  "📍 Localização",
  "📎 Documento",
  "📷 Imagem",
];

/** Seletor de variacao e juntor de largura zero nao distinguem criativo. */
const COSMETIC_CODEPOINTS = /[︎️‍]/g;

export function isMediaPlaceholder(body: string | null | undefined): boolean {
  if (!body) return false;
  const trimmed = body.trim();
  return MEDIA_PLACEHOLDERS.some(
    (placeholder) => trimmed === placeholder || trimmed.startsWith(placeholder + " "),
  );
}

export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Emojis presentes no texto, sem repetir e sem enfeite de codificacao. */
export function extractSignatureEmojis(body: string | null | undefined): string[] {
  if (!body) return [];
  const found = body.replace(COSMETIC_CODEPOINTS, "").match(/\p{Extended_Pictographic}/gu);
  if (!found) return [];
  return [...new Set(found)];
}

function normalizeEmoji(value: string): string {
  return value.replace(COSMETIC_CODEPOINTS, "").trim();
}

/**
 * Escolhe a regra que corresponde a mensagem.
 *
 * Regra com `matchText` vence a regra so de emoji, porque ela e mais
 * especifica - e o caso de um mesmo emoji atender dois criativos que so se
 * diferenciam pelo texto.
 *
 * Devolve null quando duas regras igualmente especificas disputam a mesma
 * mensagem. Nesse empate, chutar significaria creditar receita ao anuncio
 * errado, o que e pior do que ficar sem atribuicao.
 */
export function matchAdCreative(
  rules: AdCreativeSignature[],
  body: string | null | undefined,
): AdCreativeSignature | null {
  if (isMediaPlaceholder(body)) return null;

  const emojis = extractSignatureEmojis(body);
  if (emojis.length === 0) return null;

  const present = new Set(emojis.map(normalizeEmoji));
  const normalizedBody = normalizeText(body);

  const candidates = rules.filter((rule) => rule.active && present.has(normalizeEmoji(rule.emoji)));
  if (candidates.length === 0) return null;

  const withText = candidates.filter((rule) => {
    const needle = normalizeText(rule.matchText);
    return needle !== "" && normalizedBody.includes(needle);
  });
  if (withText.length === 1) return withText[0];
  if (withText.length > 1) return null;

  const emojiOnly = candidates.filter((rule) => normalizeText(rule.matchText) === "");
  if (emojiOnly.length === 1) return emojiOnly[0];

  return null;
}
