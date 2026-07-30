import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/conversation-search-test.mjs";
  await build({
    entryPoints: ["lib/chat/conversation-search.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

const conversation = {
  leadName: "Vitória Ponciano",
  leadSubtitle: "ACT Impermeabilizantes",
  leadPhone: "+55 (51) 99999-1234",
};

test("texto sem digitos nao casa com todas as conversas pelo telefone vazio", async () => {
  const { matchesConversationSearch } = await loadModule();
  assert.equal(matchesConversationSearch(conversation, "Carolina"), false);
});

test("busca nome ignorando acentos e diferenca entre maiusculas", async () => {
  const { matchesConversationSearch } = await loadModule();
  assert.equal(matchesConversationSearch(conversation, "vitoria"), true);
  assert.equal(matchesConversationSearch(conversation, "PONCIANO"), true);
});

test("busca telefone com ou sem formatacao", async () => {
  const { matchesConversationSearch } = await loadModule();
  assert.equal(matchesConversationSearch(conversation, "99999-1234"), true);
  assert.equal(matchesConversationSearch(conversation, "5551999991234"), true);
});

test("busca tambem pelo subtitulo e aceita consulta vazia", async () => {
  const { matchesConversationSearch } = await loadModule();
  assert.equal(matchesConversationSearch(conversation, "impermeabilizantes"), true);
  assert.equal(matchesConversationSearch(conversation, "   "), true);
});
