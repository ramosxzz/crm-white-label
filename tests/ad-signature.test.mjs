import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/ad-signature-test.mjs";
  await build({
    entryPoints: ["lib/meta/ad-signature.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { matchAdCreative, extractSignatureEmojis, isMediaPlaceholder } = await loadModule();

const rule = (over) => ({
  id: "r",
  emoji: "📍",
  matchText: null,
  creativeName: "Criativo",
  adId: null,
  active: true,
  ...over,
});

test("atribui pelo emoji da mensagem de abertura", () => {
  const rules = [
    rule({ id: "a", emoji: "⌚", creativeName: "Relogio" }),
    rule({ id: "b", emoji: "📍", creativeName: "Pin" }),
  ];
  const hit = matchAdCreative(rules, "Olá! Tenho interesse no curso e queria mais informações, por favor. 📍");
  assert.equal(hit?.creativeName, "Pin");
});

test("mensagem sem emoji nao e atribuida", () => {
  const rules = [rule({ emoji: "📍", creativeName: "Pin" })];
  assert.equal(matchAdCreative(rules, "Bom dia, gostaria de informações"), null);
});

test("localizacao enviada pelo cliente nao vira venda de criativo", () => {
  // O CRM grava "📍 Localização" no lugar da midia, e o pin ja e emoji de um
  // criativo real. Sem essa guarda, todo cliente que mandasse localizacao
  // seria creditado aquele anuncio.
  const rules = [rule({ emoji: "📍", creativeName: "Pin" })];
  assert.equal(matchAdCreative(rules, "📍 Localização"), null);
  assert.equal(isMediaPlaceholder("📍 Localização"), true);
  assert.equal(isMediaPlaceholder("🎤 Áudio"), true);
  assert.equal(isMediaPlaceholder("Olá! Interesse no curso 📍"), false);
});

test("regra com texto vence a regra so de emoji", () => {
  const rules = [
    rule({ id: "generica", emoji: "🏙️", creativeName: "Cidade generica" }),
    rule({ id: "poa", emoji: "🏙️", matchText: "Porto Alegre", creativeName: "Curso POA" }),
    rule({ id: "slz", emoji: "🏙️", matchText: "SãoLeopoldo", creativeName: "Curso Sao Leopoldo" }),
  ];
  const hit = matchAdCreative(rules, "Olá! Gostaria de saber mais sobre o curso de Porto Alegre, por favor!🏙️");
  assert.equal(hit?.creativeName, "Curso POA");
});

test("texto casa sem depender de acento e caixa", () => {
  const rules = [rule({ emoji: "🏙️", matchText: "SÃO LEOPOLDO", creativeName: "SL" })];
  const hit = matchAdCreative(rules, "Olá! curso de sao leopoldo!🏙️");
  assert.equal(hit?.creativeName, "SL");
});

test("empate entre dois criativos nao atribui a nenhum", () => {
  // Creditar receita ao anuncio errado e pior do que ficar sem atribuicao.
  const rules = [
    rule({ id: "a", emoji: "⌚", creativeName: "Relogio" }),
    rule({ id: "b", emoji: "📍", creativeName: "Pin" }),
  ];
  assert.equal(matchAdCreative(rules, "Interesse! ⌚ 📍"), null);
});

test("regra desativada nao atribui", () => {
  const rules = [rule({ emoji: "📍", creativeName: "Pin", active: false })];
  assert.equal(matchAdCreative(rules, "Interesse 📍"), null);
});

test("seletor de variacao nao impede o casamento", () => {
  // "☀️" carrega um seletor invisivel que "☀" nao tem; sem normalizar, a
  // regra cadastrada de um jeito nunca casaria com a mensagem do outro.
  const rules = [rule({ emoji: "☀", creativeName: "Sol" })];
  const hit = matchAdCreative(rules, "Olá! Tenho interesse e queria mais informações, por favor.☀️");
  assert.equal(hit?.creativeName, "Sol");
});

test("extrai emojis sem repetir", () => {
  assert.deepEqual(extractSignatureEmojis("oi 📍 tudo bem 📍 ⌚"), ["📍", "⌚"]);
  assert.deepEqual(extractSignatureEmojis("sem emoji aqui"), []);
  assert.deepEqual(extractSignatureEmojis(null), []);
});

test("mensagem vazia ou nula nao quebra", () => {
  const rules = [rule({})];
  assert.equal(matchAdCreative(rules, null), null);
  assert.equal(matchAdCreative(rules, ""), null);
  assert.equal(matchAdCreative([], "Interesse 📍"), null);
});
