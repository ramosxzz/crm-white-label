import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("configuracao do menu salva automaticamente e atualiza a sidebar ao vivo", async () => {
  const form = await readFile("app/(app)/settings/navigation-visibility-form.tsx", "utf8");
  const sidebar = await readFile("components/app/sidebar.tsx", "utf8");
  const mobile = await readFile("components/app/mobile-bottom-nav.tsx", "utf8");

  assert.match(form, /applyAndSave/);
  assert.match(form, /toggleGroup/);
  assert.match(form, /announceTenantNavigationUpdate/);
  assert.doesNotMatch(form, /Salvar menu lateral/);
  assert.match(sidebar, /TENANT_NAVIGATION_UPDATED_EVENT/);
  assert.match(mobile, /TENANT_NAVIGATION_UPDATED_EVENT/);
});

test("modulos de tarefa e reuniao controlam tambem as acoes internas", async () => {
  const loader = await readFile("app/(app)/chat/[leadId]/get-thread-data.ts", "utf8");
  const chat = await readFile("app/(app)/chat/[leadId]/chat-thread.tsx", "utf8");
  const lead = await readFile("app/(app)/leads/[id]/page.tsx", "utf8");

  assert.match(loader, /meetingsEnabled: isNavigationItemEnabled/);
  assert.match(loader, /tasksEnabled: isNavigationItemEnabled/);
  assert.match(chat, /\{meetingsEnabled && \(/);
  assert.match(chat, /\{tasksEnabled && <InfoRow/);
  assert.match(lead, /\{meetingsEnabled && \(/);
  assert.match(lead, /\{tasksEnabled && <TaskPanel/);
});
