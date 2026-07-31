import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/realtime-conversation-update-test.mjs";
  await build({
    entryPoints: ["lib/chat/realtime-conversation-update.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

function conversation(overrides = {}) {
  return {
    id: "conv-1",
    leadId: "lead-1",
    leadName: "Cliente",
    leadPhone: "5511999999999",
    leadAvatarUrl: null,
    leadSubtitle: "",
    lastAt: "2026-07-31T12:00:00.000Z",
    unread: 2,
    lastPreview: "Anterior",
    lastDirection: "inbound",
    status: "aguardando",
    whatsappAccountId: "account-1",
    tags: [],
    stageId: null,
    leadCreatedAt: null,
    qualityStars: 0,
    ...overrides,
  };
}

test("mensagem recebida aparece imediatamente e incrementa o contador", async () => {
  const { applyRealtimeMessageToConversationItems } = await loadModule();
  const result = applyRealtimeMessageToConversationItems([conversation()], {
    conversation_id: "conv-1",
    direction: "inbound",
    body: "Chegou agora",
    created_at: "2026-07-31T12:01:00.000Z",
  });

  assert.equal(result.matched, true);
  assert.equal(result.items[0].lastPreview, "Chegou agora");
  assert.equal(result.items[0].lastAt, "2026-07-31T12:01:00.000Z");
  assert.equal(result.items[0].unread, 3);
});

test("mensagem de mídia recebe uma prévia sem esperar a consulta", async () => {
  const { applyRealtimeMessageToConversationItems } = await loadModule();
  const result = applyRealtimeMessageToConversationItems([conversation()], {
    conversation_id: "conv-1",
    direction: "inbound",
    media_type: "audio/ogg",
  });

  assert.equal(result.items[0].lastPreview, "🎤 Áudio");
});

test("conversa ainda fora do escopo não é inventada no cliente", async () => {
  const { applyRealtimeMessageToConversationItems } = await loadModule();
  const current = [conversation()];
  const result = applyRealtimeMessageToConversationItems(current, {
    conversation_id: "conv-de-outro-vendedor",
    direction: "inbound",
    body: "Privada",
  });

  assert.equal(result.matched, false);
  assert.equal(result.items, current);
});

test("mensagem enviada atualiza a prévia e zera não lidas", async () => {
  const { applyRealtimeMessageToConversationItems } = await loadModule();
  const result = applyRealtimeMessageToConversationItems([conversation()], {
    conversation_id: "conv-1",
    direction: "outbound",
    body: "Vou verificar",
  });

  assert.equal(result.items[0].lastDirection, "outbound");
  assert.equal(result.items[0].lastPreview, "Vou verificar");
  assert.equal(result.items[0].unread, 0);
});
