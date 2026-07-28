import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-offline-queue-test.mjs";
  await build({
    entryPoints: ["lib/field-service/offline-queue.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

function mutation(overrides) {
  return {
    id: overrides.id,
    kind: overrides.kind,
    serviceOrderId: overrides.serviceOrderId ?? "os-1",
    createdAt: overrides.createdAt ?? 0,
    payload: overrides.payload ?? {},
    attempts: overrides.attempts ?? 0,
  };
}

test("assinatura e conclusao vao depois de avaria e upsell da mesma OS", async () => {
  const { sortQueue } = await loadModule();
  const sorted = sortQueue([
    mutation({ id: "a", kind: "status", createdAt: 1 }),
    mutation({ id: "b", kind: "signature", createdAt: 2 }),
    mutation({ id: "c", kind: "damage", createdAt: 3 }),
    mutation({ id: "d", kind: "upsell_item", createdAt: 4 }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["c", "d", "b", "a"],
  );
});

test("OS diferentes mantem ordem cronologica entre si", async () => {
  const { sortQueue } = await loadModule();
  const sorted = sortQueue([
    mutation({ id: "b", kind: "damage", serviceOrderId: "os-2", createdAt: 20 }),
    mutation({ id: "a", kind: "damage", serviceOrderId: "os-1", createdAt: 10 }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["a", "b"],
  );
});

test("assinatura repetida offline mantem so a ultima", async () => {
  const { dedupeQueue } = await loadModule();
  const result = dedupeQueue([
    mutation({ id: "sig-1", kind: "signature", createdAt: 1 }),
    mutation({ id: "sig-2", kind: "signature", createdAt: 5 }),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "sig-2");
});

test("avarias nunca sao descartadas na deduplicacao", async () => {
  const { dedupeQueue } = await loadModule();
  const result = dedupeQueue([
    mutation({ id: "d1", kind: "damage", createdAt: 1 }),
    mutation({ id: "d2", kind: "damage", createdAt: 2 }),
    mutation({ id: "d3", kind: "damage", createdAt: 3 }),
  ]);
  assert.equal(result.length, 3);
});

test("assinatura de OS diferentes nao se atropelam", async () => {
  const { dedupeQueue } = await loadModule();
  const result = dedupeQueue([
    mutation({ id: "sig-a", kind: "signature", serviceOrderId: "os-1", createdAt: 1 }),
    mutation({ id: "sig-b", kind: "signature", serviceOrderId: "os-2", createdAt: 2 }),
  ]);
  assert.equal(result.length, 2);
});

test("falha de um item nao impede o envio dos outros", async () => {
  const { flushQueue } = await loadModule();
  const outcome = await flushQueue(
    [
      mutation({ id: "ok-1", kind: "damage", serviceOrderId: "os-1", createdAt: 1 }),
      mutation({ id: "boom", kind: "damage", serviceOrderId: "os-2", createdAt: 2 }),
      mutation({ id: "ok-2", kind: "damage", serviceOrderId: "os-3", createdAt: 3 }),
    ],
    async (item) => {
      if (item.id === "boom") throw new Error("sem rede");
    },
  );
  assert.deepEqual(outcome.sent, ["ok-1", "ok-2"]);
  assert.equal(outcome.failed.length, 1);
  assert.equal(outcome.failed[0].error, "sem rede");
});

test("item que estourou as tentativas e abandonado sem nova chamada", async () => {
  const { flushQueue, MAX_ATTEMPTS } = await loadModule();
  let calls = 0;
  const outcome = await flushQueue(
    [mutation({ id: "velho", kind: "damage", attempts: MAX_ATTEMPTS })],
    async () => {
      calls += 1;
    },
  );
  assert.equal(calls, 0);
  assert.deepEqual(outcome.abandoned, ["velho"]);
  assert.deepEqual(outcome.sent, []);
});
