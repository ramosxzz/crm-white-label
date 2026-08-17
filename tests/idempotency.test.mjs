import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/idempotency-test.mjs";
  await build({
    entryPoints: ["lib/api/idempotency.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { hashPayload, getIdempotentResponse, saveIdempotentResponse } = await loadModule();

test("Idempotency: hash determinístico gera o mesmo valor para objetos iguais", () => {
  const obj1 = { name: "João", amount: 150 };
  const obj2 = { name: "João", amount: 150 };
  const obj3 = { name: "Maria", amount: 200 };

  assert.equal(hashPayload(obj1), hashPayload(obj2));
  assert.notEqual(hashPayload(obj1), hashPayload(obj3));
});

test("Idempotency: recupera resposta em cache e detecta conflito de payload", async () => {
  const store = new Map();
  const fakeSupabase = {
    from: (table) => ({
      select: () => ({
        eq: function (col, val) {
          this[col] = val;
          return this;
        },
        maybeSingle: async function () {
          const item = store.get(this.key);
          return { data: item || null, error: null };
        },
      }),
      upsert: async (record) => {
        store.set(record.key, record);
        return { error: null };
      },
    }),
  };

  const key = "req-uuid-123";
  const tenantId = "tenant-abc";
  const endpoint = "/api/intake/lead";
  const payload = { name: "Lead Teste", phone: "11999999999" };

  // 1. Primeira checagem (sem cache)
  const initial = await getIdempotentResponse(fakeSupabase, { key, tenantId, endpoint, payload });
  assert.equal(initial.cached, null);
  assert.equal(initial.conflict, false);

  // 2. Salva a resposta gerada
  await saveIdempotentResponse(fakeSupabase, {
    key,
    tenantId,
    endpoint,
    payload,
    status: 201,
    body: { ok: true, lead_id: "lead-456" },
  });

  // 3. Segunda requisição com a MESMA chave e MESMO payload
  const second = await getIdempotentResponse(fakeSupabase, { key, tenantId, endpoint, payload });
  assert.ok(second.cached);
  assert.equal(second.cached.responseStatus, 201);
  assert.deepEqual(second.cached.responseBody, { ok: true, lead_id: "lead-456" });
  assert.equal(second.conflict, false);

  // 4. Terceira requisição com a MESMA chave mas OUTRO payload (conflito)
  const third = await getIdempotentResponse(fakeSupabase, {
    key,
    tenantId,
    endpoint,
    payload: { name: "Outro Nome", phone: "11888888888" },
  });
  assert.equal(third.conflict, true);
});
