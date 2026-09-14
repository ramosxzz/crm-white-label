import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("rodizio notifica somente a pessoa que recebeu o lead e abre o chat", () => {
  const source = read("lib/automations/execute.ts");
  assert.match(source, /userId:\s*String\(data\.assigned_to\)/);
  assert.match(source, /kind:\s*"lead_assigned"/);
  assert.match(source, /link:\s*`\/chat\/\$\{leadId\}`/);
});

test("atribuicoes manuais e encaminhamento abrem direto no conversador", () => {
  const leads = read("app/(app)/leads/actions.ts");
  const chat = read("app/(app)/chat/actions.ts");
  const forward = read("lib/leads/forward-new-lead.ts");
  assert.match(leads, /link:\s*`\/chat\/\$\{input\.leadId\}`/);
  assert.match(chat, /link:\s*`\/chat\/\$\{input\.leadId\}`/);
  assert.match(forward, /link:\s*`\/chat\/\$\{leadId\}`/);
});

test("alerta em tempo real oferece acesso direto a conversa", () => {
  const source = read("components/app/notifications-bell.tsx");
  assert.match(source, /next\.kind === "lead_assigned"/);
  assert.match(source, /Abrir conversa e enviar mensagem/);
  assert.match(source, /\/sounds\/notification\.mp3/);
});
