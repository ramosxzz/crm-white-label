import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/webhook-queue-test.mjs";
  await build({
    entryPoints: ["lib/whatsapp/queue-processor.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { enqueueWebhookEvent, processQueueItem } = await loadModule();

test("Webhook Queue: enfileira evento no buffer", async () => {
  let inserted = null;
  const fakeSupabase = {
    from: () => ({
      insert: (record) => {
        inserted = record;
        return {
          select: () => ({
            single: async () => ({ data: { id: "queue-uuid-1" }, error: null }),
          }),
        };
      },
    }),
  };

  const id = await enqueueWebhookEvent(fakeSupabase, {
    tenantId: "tenant-1",
    provider: "cloud_api",
    payload: { test: true },
  });

  assert.equal(id, "queue-uuid-1");
  assert.equal(inserted.provider, "cloud_api");
  assert.equal(inserted.status, "pending");
});

test("Webhook Queue: processa com sucesso e marca como completed", async () => {
  const updates = [];
  const fakeSupabase = {
    from: () => ({
      update: (fields) => {
        updates.push(fields);
        return {
          eq: () => ({ error: null }),
        };
      },
    }),
  };

  let executed = false;
  const res = await processQueueItem(fakeSupabase, "queue-uuid-1", async () => {
    executed = true;
  });

  assert.equal(executed, true);
  assert.equal(res.status, "completed");
  assert.equal(updates[0].status, "processing");
  assert.equal(updates[1].status, "completed");
});

test("Webhook Queue: move para Dead Letter Queue (DLQ) se atingir o limite de tentativas", async () => {
  const updates = [];
  const fakeSupabase = {
    from: () => ({
      update: (fields) => {
        updates.push(fields);
        return {
          eq: () => ({ error: null }),
        };
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { retry_count: 2, max_retries: 3 }, error: null }),
        }),
      }),
    }),
  };

  const res = await processQueueItem(fakeSupabase, "queue-uuid-2", async () => {
    throw new Error("Timeout ao conectar com API de WhatsApp");
  });

  assert.equal(res.status, "dead_letter");
  assert.equal(res.error, "Timeout ao conectar com API de WhatsApp");
  const lastUpdate = updates[updates.length - 1];
  assert.equal(lastUpdate.status, "dead_letter");
  assert.equal(lastUpdate.retry_count, 3);
});
