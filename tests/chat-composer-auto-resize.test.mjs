import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/chat-composer-auto-resize-test.mjs";
  await build({
    entryPoints: ["lib/chat/composer-auto-resize.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

function textarea(scrollHeight) {
  return { scrollHeight, style: { height: "", overflowY: "" } };
}

test("expande o compositor ate a altura completa da mensagem", async () => {
  const { resizeChatComposer } = await loadModule();
  const element = textarea(92);

  resizeChatComposer(element);

  assert.equal(element.style.height, "92px");
  assert.equal(element.style.overflowY, "hidden");
});

test("limita mensagens longas e habilita rolagem interna", async () => {
  const { CHAT_COMPOSER_MAX_HEIGHT_PX, resizeChatComposer } = await loadModule();
  const element = textarea(260);

  resizeChatComposer(element);

  assert.equal(element.style.height, `${CHAT_COMPOSER_MAX_HEIGHT_PX}px`);
  assert.equal(element.style.overflowY, "auto");
});
