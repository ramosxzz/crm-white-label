import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/phone-format-test.mjs";
  await build({
    entryPoints: ["lib/utils.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { formatPhoneBR } = await loadModule();

test("celular com 9 (13 digitos: 55 + DDD + 9XXXXXXXX)", () => {
  assert.equal(formatPhoneBR("5551987654321"), "+55 (51) 98765-4321");
});

test("fixo/celular antigo sem o 9 extra (12 digitos)", () => {
  // Caso real que chegava cru na tela: 555191023865.
  assert.equal(formatPhoneBR("555191023865"), "+55 (51) 9102-3865");
});

test("celular sem DDI (11 digitos)", () => {
  assert.equal(formatPhoneBR("11987654321"), "(11) 98765-4321");
});

test("fixo sem DDI (10 digitos)", () => {
  assert.equal(formatPhoneBR("1132654321"), "(11) 3265-4321");
});

test("nulo/vazio nao quebra", () => {
  assert.equal(formatPhoneBR(null), "");
  assert.equal(formatPhoneBR(undefined), "");
  assert.equal(formatPhoneBR(""), "");
});

test("formato nao reconhecido volta cru", () => {
  assert.equal(formatPhoneBR("123"), "123");
});
