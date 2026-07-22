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
            contents: "export const createServiceClient = () => ({}); export const canSeeAllLeads = () => false; export const buildConversationItems = () => [];",
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

test("no blocklist (owner/admin) -> everything visible", async () => {
  const { filterByAllowedAccounts } = await loadModule();
  const items = [item("acc-a"), item("acc-b"), item(null)];
  const result = filterByAllowedAccounts(items, null);
  assert.equal(result.length, 3);
});

test("empty blocklist -> everything visible", async () => {
  const { filterByAllowedAccounts } = await loadModule();
  const items = [item("acc-a"), item(null)];
  const result = filterByAllowedAccounts(items, []);
  assert.equal(result.length, 2);
});

test("blocks only conversations from accounts assigned to someone else", async () => {
  const { filterByAllowedAccounts } = await loadModule();
  const items = [item("acc-a"), item("acc-b")];
  const result = filterByAllowedAccounts(items, ["acc-b"]);
  assert.deepEqual(result.map((i) => i.whatsappAccountId), ["acc-a"]);
});

test("shared/unassigned account (null whatsappAccountId) is never blocked", async () => {
  // Regressao: tenants com 1 numero compartilhado (assigned_to null) nao
  // podem perder acesso as proprias conversas quando a denylist bloqueia
  // contas de outras pessoas.
  const { filterByAllowedAccounts } = await loadModule();
  const items = [item(null), item("acc-blocked")];
  const result = filterByAllowedAccounts(items, ["acc-blocked"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].whatsappAccountId, null);
});
