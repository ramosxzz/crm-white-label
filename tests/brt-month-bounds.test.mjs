import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/brt-month-bounds-test.mjs";
  await build({
    entryPoints: ["lib/date/brt.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { getBRTMonthBounds } = await loadModule();

test("mes atual: julho de 2026", () => {
  const ref = new Date("2026-07-29T15:00:00Z");
  const b = getBRTMonthBounds(0, ref);
  assert.equal(b.dateStr, "2026-07-01");
  assert.equal(b.startIso, new Date("2026-07-01T03:00:00.000Z").toISOString());
  assert.equal(b.endIso, new Date("2026-08-01T03:00:00.000Z").toISOString());
});

test("mes anterior: de julho volta pra junho", () => {
  const ref = new Date("2026-07-29T15:00:00Z");
  const b = getBRTMonthBounds(-1, ref);
  assert.equal(b.dateStr, "2026-06-01");
  assert.equal(b.endIso, new Date("2026-07-01T03:00:00.000Z").toISOString());
});

test("virada de ano: janeiro - 1 mes cai em dezembro do ano anterior", () => {
  const ref = new Date("2026-01-15T15:00:00Z");
  const b = getBRTMonthBounds(-1, ref);
  assert.equal(b.dateStr, "2025-12-01");
  assert.equal(b.endIso, new Date("2026-01-01T03:00:00.000Z").toISOString());
});

test("virada de ano: dezembro + 1 mes cai em janeiro do ano seguinte", () => {
  const ref = new Date("2026-12-10T15:00:00Z");
  const b = getBRTMonthBounds(1, ref);
  assert.equal(b.dateStr, "2027-01-01");
});
