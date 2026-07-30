import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-status-test.mjs";
  await build({ entryPoints: ["lib/field-service/status.ts"], bundle: true, platform: "node", format: "esm", outfile });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

test("segue o caminho feliz da OS ate o faturamento", async () => {
  const { canTransitionServiceOrder } = await loadModule();
  assert.equal(canTransitionServiceOrder("rascunho", "agendada"), true);
  assert.equal(canTransitionServiceOrder("agendada", "em_execucao"), true);
  assert.equal(canTransitionServiceOrder("em_execucao", "concluida"), true);
  assert.equal(canTransitionServiceOrder("concluida", "conferida"), true);
  assert.equal(canTransitionServiceOrder("conferida", "faturada"), true);
});

test("nao deixa faturar pulando a conferencia do ADM", async () => {
  const { canTransitionServiceOrder } = await loadModule();
  assert.equal(canTransitionServiceOrder("concluida", "faturada"), false);
  assert.equal(canTransitionServiceOrder("em_execucao", "conferida"), false);
  assert.equal(canTransitionServiceOrder("agendada", "concluida"), false);
});

test("permite reabrir quando a conferencia acha erro", async () => {
  const { canTransitionServiceOrder } = await loadModule();
  assert.equal(canTransitionServiceOrder("concluida", "em_execucao"), true);
  assert.equal(canTransitionServiceOrder("conferida", "concluida"), true);
});

test("remarcada volta pra fila de agendamento", async () => {
  const { canTransitionServiceOrder } = await loadModule();
  assert.equal(canTransitionServiceOrder("agendada", "remarcada"), true);
  assert.equal(canTransitionServiceOrder("em_execucao", "remarcada"), true);
  assert.equal(canTransitionServiceOrder("remarcada", "agendada"), true);
});

test("faturada e cancelada sao terminais", async () => {
  const { canTransitionServiceOrder, isServiceOrderClosed } = await loadModule();
  assert.equal(isServiceOrderClosed("faturada"), true);
  assert.equal(isServiceOrderClosed("cancelada"), true);
  assert.equal(isServiceOrderClosed("agendada"), false);
  assert.equal(canTransitionServiceOrder("faturada", "conferida"), false);
  assert.equal(canTransitionServiceOrder("cancelada", "agendada"), false);
});

test("assistencia nao fatura e so pode ser reaberta", async () => {
  const { canTransitionServiceOrder, isServiceOrderLocked } = await loadModule();
  assert.equal(canTransitionServiceOrder("assistencia", "faturada"), false);
  assert.equal(canTransitionServiceOrder("assistencia", "conferida"), false);
  assert.equal(canTransitionServiceOrder("assistencia", "em_execucao"), true);
  assert.equal(isServiceOrderLocked("assistencia"), true);
});

test("formata o codigo visivel da OS", async () => {
  const { formatServiceOrderCode } = await loadModule();
  assert.equal(formatServiceOrderCode(1), "OS-0001");
  assert.equal(formatServiceOrderCode(1234), "OS-1234");
  assert.equal(formatServiceOrderCode(99999), "OS-99999");
});
