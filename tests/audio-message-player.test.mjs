import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("player carrega metadados e atualiza a duracao do audio", async () => {
  const source = await readFile("app/(app)/chat/[leadId]/chat-thread.tsx", "utf8");
  assert.match(source, /preload="metadata"/);
  assert.match(source, /onLoadedMetadata=/);
  assert.match(source, /onDurationChange=/);
  assert.match(source, /setDuration\(audio\.duration\)/);
});
