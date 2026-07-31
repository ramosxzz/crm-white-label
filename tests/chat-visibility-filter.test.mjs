import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/chat-visibility-filter-test.mjs";
  await build({
    entryPoints: ["lib/chat/list-conversation-items.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    external: ["@/lib/supabase/server", "@/lib/auth/roles"],
    plugins: [
      {
        name: "stub-external",
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/(supabase\/server|auth\/roles|chat\/build-conversation-items)$/ }, (args) => ({
            path: args.path,
            namespace: "stub",
          }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: "export const createServiceClient = () => ({}); export const canSeeAllLeads = (role) => ['owner', 'admin', 'gerente'].includes(role); export const buildConversationItems = () => [];",
            loader: "js",
          }));
        },
      },
    ],
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

function item(whatsappAccountId) {
  return { id: `conv-${whatsappAccountId ?? "none"}`, whatsappAccountId };
}

test("gestao ve todas as contas e conversas sem vinculo", async () => {
  const { buildChatAccountVisibility } = await loadModule();
  const result = buildChatAccountVisibility(
    [{ id: "acc-a", assigned_to: "seller-a" }],
    "manager",
    "gerente",
  );
  assert.equal(result, null);
});

test("visibilidade nula (gestao) mantem tudo visivel", async () => {
  const { filterByAllowedAccounts } = await loadModule();
  const items = [item("acc-a"), item("acc-b"), item(null)];
  const result = filterByAllowedAccounts(items, null);
  assert.equal(result.length, 3);
});

test("vendedor ve apenas o proprio numero e nunca conversa sem vinculo", async () => {
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [
      { id: "acc-a", assigned_to: "seller-a" },
      { id: "acc-b", assigned_to: "seller-b" },
      { id: "shared", assigned_to: null },
    ],
    "seller-a",
    "vendedor",
  );
  const result = filterByAllowedAccounts(
    [item("acc-a"), item("acc-b"), item("shared"), item(null)],
    visibility,
  );
  assert.deepEqual(result.map((i) => i.whatsappAccountId), ["acc-a"]);
});

test("vendedor sem numero atribuido nao herda o historico compartilhado", async () => {
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [{ id: "shared", assigned_to: null }],
    "seller-a",
    "vendedor",
  );
  const result = filterByAllowedAccounts([item("shared"), item(null)], visibility);
  assert.deepEqual(result, []);
});

test("numero da equipe aparece pro vendedor sem numero proprio", async () => {
  // O caso da Atacado Moda Sul: uma loja, um numero, varios vendedores.
  // Antes disso o vendedor abria o chat vazio.
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [{ id: "loja", assigned_to: null, shared_with_all: true }],
    "seller-a",
    "vendedor",
  );
  const result = filterByAllowedAccounts([item("loja"), item(null)], visibility);
  assert.deepEqual(result.map((i) => i.whatsappAccountId), ["loja", null]);
});

test("vendedor com numero proprio ve o dele E o da equipe, nao o do colega", async () => {
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [
      { id: "meu", assigned_to: "seller-a" },
      { id: "colega", assigned_to: "seller-b" },
      { id: "loja", assigned_to: null, shared_with_all: true },
      { id: "orfao", assigned_to: null },
    ],
    "seller-a",
    "vendedor",
  );
  const result = filterByAllowedAccounts(
    [item("meu"), item("colega"), item("loja"), item("orfao")],
    visibility,
  );
  assert.deepEqual(result.map((i) => i.whatsappAccountId), ["meu", "loja"]);
});

test("sem responsavel continua invisivel pro vendedor - nao vira compartilhado sozinho", async () => {
  // Numero recem-cadastrado nao pode virar publico por descuido.
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [{ id: "orfao", assigned_to: null, shared_with_all: false }],
    "seller-a",
    "vendedor",
  );
  assert.deepEqual(filterByAllowedAccounts([item("orfao")], visibility), []);
});

test("tenant sem distribuicao de leads nao separa por numero", async () => {
  // A RLS de leads ja libera tudo quando lead_assignment_enabled e false;
  // a tela nao pode ficar mais restrita que o banco.
  const { buildChatAccountVisibility } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [{ id: "acc-a", assigned_to: "seller-b" }],
    "seller-a",
    "vendedor",
    false,
  );
  assert.equal(visibility, null);
});

test("com distribuicao ligada o escopo por vendedor continua valendo", async () => {
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [
      { id: "meu", assigned_to: "seller-a" },
      { id: "colega", assigned_to: "seller-b" },
    ],
    "seller-a",
    "vendedor",
    true,
  );
  const result = filterByAllowedAccounts([item("meu"), item("colega")], visibility);
  assert.deepEqual(result.map((i) => i.whatsappAccountId), ["meu"]);
});

test("atendente de tenant compartilhado preserva numero e historico sem vinculo", async () => {
  const { buildChatAccountVisibility, filterByAllowedAccounts } = await loadModule();
  const visibility = buildChatAccountVisibility(
    [
      { id: "shared", assigned_to: null },
      { id: "private", assigned_to: "seller-a" },
    ],
    "attendant-a",
    "atendente",
  );
  const result = filterByAllowedAccounts(
    [item("shared"), item("private"), item(null)],
    visibility,
  );
  assert.deepEqual(result.map((i) => i.whatsappAccountId), ["shared", null]);
});
