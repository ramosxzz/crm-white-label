import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("chat da equipe persiste leitura ao abrir e ao receber mensagem visivel", async () => {
  const thread = await readFile("app/(app)/team-chat/team-chat-thread.tsx", "utf8");
  assert.match(thread, /markVisibleMessagesRead\(\)/);
  assert.match(thread, /markTeamChatRead\(\)/);
  assert.match(thread, /visibilitychange/);
  assert.match(thread, /TEAM_CHAT_READ_EVENT/);
});

test("sidebar nao incrementa badge enquanto chat da equipe esta visivel", async () => {
  const sidebar = await readFile("components/app/sidebar.tsx", "utf8");
  assert.match(sidebar, /pathnameRef\.current\.startsWith\("\/team-chat"\)/);
  assert.match(sidebar, /document\.visibilityState === "visible"/);
  assert.match(sidebar, /row\.sender_id !== userId && !viewingTeamChat/);
});
