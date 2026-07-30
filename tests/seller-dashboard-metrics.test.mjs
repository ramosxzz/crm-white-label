import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const outfile = "node_modules/.cache/seller-dashboard-metrics-test.mjs";
  await build({
    entryPoints: ["lib/dashboard/seller-metrics.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  return import(`${pathToFileURL(`${process.cwd()}/${outfile}`).href}?t=${Date.now()}`);
}

test("soma atribuicao direta e pelo numero sem duplicar", async () => {
  const { combineScopedCounts } = await loadModule();
  assert.equal(combineScopedCounts(4, 10, 3), 11);
});

test("vendedora sem atividade continua com zero", async () => {
  const { combineScopedCounts } = await loadModule();
  assert.equal(combineScopedCounts(0, 0, 0), 0);
});

test("contador nunca fica negativo com dados inconsistentes", async () => {
  const { combineScopedCounts } = await loadModule();
  assert.equal(combineScopedCounts(1, 1, 3), 0);
});
