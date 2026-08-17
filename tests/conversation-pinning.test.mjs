import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/conversation-pinning-test.mjs";
  await build({
    entryPoints: ["lib/chat/conversation-filter.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

function conversation(id, phone, lastMessageAt, pinnedAt = null) {
  return {
    id,
    lead_id: `lead-${id}`,
    channel: "whatsapp",
    last_message_at: lastMessageAt,
    pinned_at: pinnedAt,
    unread_count: 0,
    status: "em_atendimento",
    leads: { name: `Contato ${id}`, phone },
  };
}

test("conversa fixada fica acima de uma mensagem mais recente", async () => {
  const { filterConversationRows } = await loadModule();
  const rows = [
    conversation("recente", "5551999990001", "2026-08-17T15:00:00.000Z"),
    conversation("fixada", "5551999990002", "2026-08-10T15:00:00.000Z", "2026-08-17T14:00:00.000Z"),
  ];

  assert.deepEqual(filterConversationRows(rows, null).map((row) => row.id), ["fixada", "recente"]);
});

test("entre fixadas, a ultima fixada aparece primeiro", async () => {
  const { filterConversationRows } = await loadModule();
  const rows = [
    conversation("primeira", "5551999990003", "2026-08-17T15:00:00.000Z", "2026-08-17T13:00:00.000Z"),
    conversation("segunda", "5551999990004", "2026-08-16T15:00:00.000Z", "2026-08-17T14:00:00.000Z"),
  ];

  assert.deepEqual(filterConversationRows(rows, null).map((row) => row.id), ["segunda", "primeira"]);
});
