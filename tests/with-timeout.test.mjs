import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/with-timeout-test.mjs";
  await build({
    entryPoints: ["lib/async/with-timeout.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { withTimeout, TimeoutError } = await loadModule();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("resolve normalmente quando termina antes do prazo", async () => {
  const result = await withTimeout(wait(10).then(() => "ok"), 200, "estourou");
  assert.equal(result, "ok");
});

test("rejeita com TimeoutError quando estoura o prazo", async () => {
  await assert.rejects(
    withTimeout(wait(200).then(() => "tarde demais"), 20, "conexão muito lenta"),
    (err) => {
      assert.ok(err instanceof TimeoutError);
      assert.equal(err.message, "conexão muito lenta");
      return true;
    },
  );
});

test("propaga o erro original quando a promise rejeita antes do prazo", async () => {
  const falha = wait(10).then(() => {
    throw new Error("falha real");
  });
  await assert.rejects(withTimeout(falha, 200, "estourou"), /falha real/);
});
