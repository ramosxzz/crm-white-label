import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-agenda-test.mjs";
  await build({
    entryPoints: ["lib/field-service/agenda.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(`${process.cwd()}/${outfile}`).href + `?v=${Date.now()}`);
}

test("agenda ACT usa verde para OS agendada normal", async () => {
  const { agendaCardTone } = await loadModule();
  assert.equal(
    agendaCardTone({ status: "agendada", confirmedAt: null, hasPendingIssue: false }),
    "verde",
  );
  assert.equal(
    agendaCardTone({ status: "agendada", confirmedAt: "2026-09-12T12:00:00Z", hasPendingIssue: false }),
    "verde",
  );
});

test("excecoes operacionais sobrepoem o verde", async () => {
  const { agendaCardTone } = await loadModule();
  assert.equal(agendaCardTone({ status: "remarcada", confirmedAt: null, hasPendingIssue: false }), "laranja");
  assert.equal(agendaCardTone({ status: "cancelada", confirmedAt: null, hasPendingIssue: false }), "cinza");
  assert.equal(agendaCardTone({ status: "em_execucao", confirmedAt: null, hasPendingIssue: false }), "roxo");
  assert.equal(agendaCardTone({ status: "agendada", confirmedAt: null, hasPendingIssue: true }), "vermelho");
});
