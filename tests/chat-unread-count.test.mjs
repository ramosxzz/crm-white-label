import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const outfile = "node_modules/.cache/chat-unread-count-test.mjs";
  await build({
    entryPoints: ["lib/chat/unread-count.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  return import(`${pathToFileURL(`${process.cwd()}/${outfile}`).href}?t=${Date.now()}`);
}

test("mensagem recebida incrementa o contador", async () => {
  const { nextConversationUnreadCount } = await loadModule();
  assert.equal(nextConversationUnreadCount(4, "inbound"), 5);
});

test("contador ausente comeca em um ao receber", async () => {
  const { nextConversationUnreadCount } = await loadModule();
  assert.equal(nextConversationUnreadCount(null, "inbound"), 1);
});

test("mensagem enviada zera contadores antigos", async () => {
  const { nextConversationUnreadCount } = await loadModule();
  assert.equal(nextConversationUnreadCount(14, "outbound"), 0);
});
