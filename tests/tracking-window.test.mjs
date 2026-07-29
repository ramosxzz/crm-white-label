import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/tracking-window-test.mjs";
  await build({
    entryPoints: ["lib/field-service/tracking-window.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { brtHour, isWithinTrackingWindow, isPositionFresh, POSITION_STALE_MS } =
  await loadModule();

// Brasilia e UTC-3 o ano todo desde o fim do horario de verao.
const brt = (h, m = 0) => new Date(Date.UTC(2026, 6, 29, h + 3, m));

test("brtHour converte pro fuso de Brasilia, nao do servidor", () => {
  assert.equal(brtHour(brt(9)), 9);
  assert.equal(brtHour(brt(0)), 0);
  assert.equal(brtHour(brt(23)), 23);
});

test("dentro do expediente compartilha", () => {
  for (const h of [6, 8, 12, 17, 19]) {
    assert.equal(isWithinTrackingWindow(brt(h)), true, `${h}h deveria compartilhar`);
  }
});

test("fora do expediente nao compartilha", () => {
  for (const h of [0, 3, 5, 20, 21, 23]) {
    assert.equal(isWithinTrackingWindow(brt(h)), false, `${h}h nao deveria compartilhar`);
  }
});

test("as bordas da janela sao exatas", () => {
  // 6h liga; 5h59 ainda nao.
  assert.equal(isWithinTrackingWindow(brt(5, 59)), false);
  assert.equal(isWithinTrackingWindow(brt(6, 0)), true);
  // 19h59 ainda vale; 20h em ponto ja parou.
  assert.equal(isWithinTrackingWindow(brt(19, 59)), true);
  assert.equal(isWithinTrackingWindow(brt(20, 0)), false);
});

test("posicao recente vale como ao vivo, velha nao", () => {
  const agora = new Date("2026-07-29T12:00:00Z");
  const minutosAtras = (m) => new Date(agora.getTime() - m * 60_000);
  assert.equal(isPositionFresh(minutosAtras(1), agora), true);
  assert.equal(isPositionFresh(minutosAtras(9), agora), true);
  assert.equal(isPositionFresh(minutosAtras(11), agora), false);
  assert.equal(isPositionFresh(minutosAtras(60), agora), false);
});

test("posicao com data invalida nunca conta como ao vivo", () => {
  assert.equal(isPositionFresh("nao é data"), false);
  assert.equal(POSITION_STALE_MS, 10 * 60 * 1000);
});
