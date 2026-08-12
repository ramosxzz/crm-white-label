import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

await mkdir("node_modules/.cache", { recursive: true });
const outfile = "node_modules/.cache/leads-operational-metrics-test.mjs";
await build({
  entryPoints: ["lib/leads/operational-metrics.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { buildQualificationMetrics, buildStageDistribution, buildCallFunnelCounts } =
  await import(`${pathToFileURL(`${process.cwd()}/${outfile}`).href}?t=${Date.now()}`);

test("qualificacao separa sem avaliacao e calcula media so dos avaliados", () => {
  const result = buildQualificationMetrics([0, 2, 2, 5, null]);
  assert.equal(result.total, 5);
  assert.equal(result.rated, 3);
  assert.equal(result.unrated, 2);
  assert.equal(result.average, 3);
  assert.deepEqual(result.distribution.map((item) => item.count), [2, 0, 2, 0, 0, 1]);
});

test("distribuicao por etapa usa o total filtrado como denominador", () => {
  const result = buildStageDistribution(
    [{ stage_id: "a", count: 3 }, { stage_id: "b", count: 1 }, { stage_id: null, count: 1 }],
    [{ id: "a", name: "Primeiro contato", color: "#f0f" }, { id: "b", name: "Fechado", color: "#0f0" }],
    5,
  );
  assert.deepEqual(result.map(({ name, count, percentage }) => ({ name, count, percentage })), [
    { name: "Primeiro contato", count: 3, percentage: 60 },
    { name: "Fechado", count: 1, percentage: 20 },
    { name: "Sem etapa", count: 1, percentage: 20 },
  ]);
});

test("funil de ligacoes deduplica leads e deriva valor, tag e etapa ganha", () => {
  const counts = buildCallFunnelCounts(8, [
    { id: "1", value_cents: 100, tags: [" Qualificado "], stage_id: "open" },
    { id: "1", value_cents: 100, tags: [" Qualificado "], stage_id: "open" },
    { id: "2", value_cents: 0, tags: ["QUALIFICADO"], stage_id: "won" },
    { id: "3", value_cents: 50, tags: [], stage_id: "won" },
  ], new Set(["won"]));
  assert.deepEqual(counts, { feita: 8, passou_valor: 2, qualificado: 2, fechado: 2 });
});

test("metricas vazias nunca produzem NaN", () => {
  const quality = buildQualificationMetrics([]);
  assert.equal(quality.average, 0);
  assert.deepEqual(buildStageDistribution([], [], 0), []);
  assert.deepEqual(buildCallFunnelCounts(0, [], new Set()), {
    feita: 0,
    passou_valor: 0,
    qualificado: 0,
    fechado: 0,
  });
});
