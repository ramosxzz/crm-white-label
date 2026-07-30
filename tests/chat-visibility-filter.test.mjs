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
