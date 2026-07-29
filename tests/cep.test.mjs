import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/cep-test.mjs";
  await build({
    entryPoints: ["lib/address/cep.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { cepDigits, formatCep, lookupCep } = await loadModule();

function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

function jsonResponse(body) {
  return { ok: true, json: async () => body };
}

test("formatCep insere o hifen so depois do quinto digito", () => {
  assert.equal(formatCep("932"), "932");
  assert.equal(formatCep("93220"), "93220");
  assert.equal(formatCep("93220640"), "93220-640");
  assert.equal(formatCep("93220-640"), "93220-640");
});

test("formatCep ignora letra e nao passa de 8 digitos", () => {
  assert.equal(formatCep("93.220-640"), "93220-640");
  assert.equal(formatCep("932206401234"), "93220-640");
  assert.equal(cepDigits("abc"), "");
});

test("lookupCep devolve o endereco do ViaCEP", async () => {
  await withFetch(
    async (url) => {
      assert.equal(url, "https://viacep.com.br/ws/93220640/json/");
      return jsonResponse({
        logradouro: "Rua Marechal Deodoro",
        bairro: "Centro",
        localidade: "Sapucaia do Sul",
        uf: "RS",
      });
    },
    async () => {
      assert.deepEqual(await lookupCep("93220-640"), {
        street: "Rua Marechal Deodoro",
        district: "Centro",
        city: "Sapucaia do Sul",
        state: "RS",
      });
    },
  );
});

test("lookupCep nao consulta com menos de 8 digitos", async () => {
  await withFetch(
    async () => assert.fail("nao deveria consultar"),
    async () => {
      assert.equal(await lookupCep("9322"), null);
    },
  );
});

test("lookupCep trata CEP inexistente, que vem 200 com erro no corpo", async () => {
  await withFetch(
    async () => jsonResponse({ erro: true }),
    async () => {
      assert.equal(await lookupCep("00000000"), null);
    },
  );
  await withFetch(
    async () => jsonResponse({ erro: "true" }),
    async () => {
      assert.equal(await lookupCep("00000000"), null);
    },
  );
});

test("lookupCep devolve string vazia quando o CEP nao tem logradouro", async () => {
  await withFetch(
    async () => jsonResponse({ logradouro: "", bairro: "", localidade: "Canoas", uf: "RS" }),
    async () => {
      assert.deepEqual(await lookupCep("92000000"), {
        street: "",
        district: "",
        city: "Canoas",
        state: "RS",
      });
    },
  );
});
