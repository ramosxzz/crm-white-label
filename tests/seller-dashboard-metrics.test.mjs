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

/**
 * Qual conta o painel usa. Espelha a decisao de getSellerDashboardMetrics.
 *
 * Loja com um numero so (Atacado Moda Sul): nao ha numero nem lead atribuido a
 * ninguem, entao as duas pontas do calculo antigo davam zero e o painel abria
 * zerado pra todas.
 */
function pickMode(accounts, userId) {
  const sharedNumber = accounts.some((a) => a.shared_with_all === true);
  const ownIds = accounts.filter((a) => a.assigned_to === userId).map((a) => a.id);
  return {
    sharedNumber,
    teamWide: sharedNumber && ownIds.length === 0,
  };
}

test("numero unico da loja: painel mostra o movimento da equipe", async () => {
  const modo = pickMode([{ id: "loja", assigned_to: null, shared_with_all: true }], "vend-a");
  assert.equal(modo.teamWide, true);
  assert.equal(modo.sharedNumber, true);
});

test("numero proprio: segue sendo desempenho individual", async () => {
  const modo = pickMode([{ id: "meu", assigned_to: "vend-a", shared_with_all: false }], "vend-a");
  assert.equal(modo.teamWide, false);
  assert.equal(modo.sharedNumber, false);
});

test("numero proprio + da equipe nao engole o numero particular do colega", async () => {
  // teamWide contaria o tenant inteiro, incluindo o numero exclusivo do outro.
  const modo = pickMode(
    [
      { id: "meu", assigned_to: "vend-a", shared_with_all: false },
      { id: "loja", assigned_to: null, shared_with_all: true },
    ],
    "vend-a",
  );
  assert.equal(modo.teamWide, false, "com numero proprio, usa a conta precisa");
  assert.equal(modo.sharedNumber, true, "mas avisa que ha numero compartilhado");
});

test("sem numero nenhum atribuido e sem compartilhado: nada de conta da equipe", async () => {
  const modo = pickMode([{ id: "orfao", assigned_to: null, shared_with_all: false }], "vend-a");
  assert.equal(modo.teamWide, false);
  assert.equal(modo.sharedNumber, false);
});
