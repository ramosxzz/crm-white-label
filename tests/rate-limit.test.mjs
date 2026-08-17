import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/rate-limit-test.mjs";
  await build({
    entryPoints: ["lib/api/rate-limit.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { checkRateLimit, _resetRateLimitStore, getClientIp } = await loadModule();

test("Rate Limit: permite requisições dentro da cota", () => {
  _resetRateLimitStore();
  const id = "test-ip-1";

  const res1 = checkRateLimit(id, { limit: 3, windowMs: 1000 });
  assert.equal(res1.success, true);
  assert.equal(res1.remaining, 2);

  const res2 = checkRateLimit(id, { limit: 3, windowMs: 1000 });
  assert.equal(res2.success, true);
  assert.equal(res2.remaining, 1);

  const res3 = checkRateLimit(id, { limit: 3, windowMs: 1000 });
  assert.equal(res3.success, true);
  assert.equal(res3.remaining, 0);
});

test("Rate Limit: bloqueia requisições excedentes (429)", () => {
  _resetRateLimitStore();
  const id = "test-ip-2";

  for (let i = 0; i < 3; i++) {
    checkRateLimit(id, { limit: 3, windowMs: 2000 });
  }

  const blocked = checkRateLimit(id, { limit: 3, windowMs: 2000 });
  assert.equal(blocked.success, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfter > 0);
});

test("Rate Limit: isola clientes com identificadores distintos", () => {
  _resetRateLimitStore();
  const idA = "client-a";
  const idB = "client-b";

  for (let i = 0; i < 2; i++) {
    checkRateLimit(idA, { limit: 2, windowMs: 1000 });
  }

  const blockedA = checkRateLimit(idA, { limit: 2, windowMs: 1000 });
  assert.equal(blockedA.success, false);

  const allowedB = checkRateLimit(idB, { limit: 2, windowMs: 1000 });
  assert.equal(allowedB.success, true);
  assert.equal(allowedB.remaining, 1);
});

test("Rate Limit: extrai IP corretamente de headers", () => {
  const reqWithCf = new Request("http://localhost", {
    headers: { "cf-connecting-ip": "203.0.113.195" },
  });
  assert.equal(getClientIp(reqWithCf), "203.0.113.195");

  const reqWithForwarded = new Request("http://localhost", {
    headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
  });
  assert.equal(getClientIp(reqWithForwarded), "198.51.100.1");
});
