import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

await mkdir("node_modules/.cache", { recursive: true });
const outfile = "node_modules/.cache/dashboard-stars-filter-test.mjs";
await build({
  entryPoints: ["lib/leads/dashboard-metrics.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { aggregateStarsForBounds } = await import(
  `${pathToFileURL(`${process.cwd()}/${outfile}`).href}?t=${Date.now()}`
);

const leads = [
  { quality_stars: 5, created_at: "2026-08-11T12:00:00.000Z" },
  { quality_stars: 3, created_at: "2026-08-10T12:00:00.000Z" },
  { quality_stars: 0, created_at: "2026-07-01T12:00:00.000Z" },
];

test("precalcula estrelas do periodo sem nova consulta ou navegacao", () => {
  const result = aggregateStarsForBounds(leads, {
    startIso: "2026-08-10T00:00:00.000Z",
    endIso: "2026-08-11T23:59:59.999Z",
  });
  assert.equal(result.average, 4);
  assert.deepEqual(result.distribution.map((item) => item.count), [0, 0, 0, 1, 0, 1]);
});

test("periodo todos inclui avaliados e sem avaliacao", () => {
  const result = aggregateStarsForBounds(leads, null);
  assert.equal(result.average, 4);
  assert.deepEqual(result.distribution.map((item) => item.count), [1, 0, 0, 1, 0, 1]);
});
