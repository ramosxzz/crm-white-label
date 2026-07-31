import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule(entryPoint, name) {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = `node_modules/.cache/${name}-${Date.now()}.mjs`;
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(`${process.cwd()}/${outfile}`).href);
}

function account(provider, credentials) {
  return {
    id: "account-id",
    tenant_id: "tenant-id",
    provider,
    phone_number: "5551999999999",
    display_name: null,
    assigned_to: null,
    credentials,
    webhook_secret: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

test("capacidades respeitam o suporte definido por provedor", async () => {
  const { messageMutationCapabilities } = await loadModule(
    "lib/chat/message-mutation-capabilities.ts",
    "message-capabilities",
  );

  assert.deepEqual(messageMutationCapabilities("evolution"), { canEdit: true, canDelete: true });
  assert.deepEqual(messageMutationCapabilities("zapi"), { canEdit: false, canDelete: true });
  assert.deepEqual(messageMutationCapabilities("cloud_api"), { canEdit: false, canDelete: false });
  assert.deepEqual(messageMutationCapabilities(null), { canEdit: false, canDelete: false });
});

test("Evolution envia o contrato correto para editar mensagem", async () => {
  const { EvolutionProvider } = await loadModule("lib/whatsapp/evolution.ts", "evolution-edit");
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new EvolutionProvider(
      account("evolution", { base_url: "https://evolution.example/", api_key: "secret", instance: "loja 1" }),
    );
    await provider.editMessage({
      to: "+55 (51) 99999-9999",
      externalId: "message-123",
      body: "Texto corrigido",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://evolution.example/chat/updateMessage/loja%201");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      number: "5551999999999",
      text: "Texto corrigido",
      key: {
        id: "message-123",
        remoteJid: "5551999999999@s.whatsapp.net",
        fromMe: true,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Evolution envia o contrato correto para apagar para todos", async () => {
  const { EvolutionProvider } = await loadModule("lib/whatsapp/evolution.ts", "evolution-delete");
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new EvolutionProvider(
      account("evolution", { base_url: "https://evolution.example", api_key: "secret", instance: "loja" }),
    );
    await provider.deleteMessage({
      to: "5551999999999",
      externalId: "message-456",
      fromMe: true,
    });

    assert.equal(calls[0].url, "https://evolution.example/chat/deleteMessageForEveryone/loja");
    assert.equal(calls[0].init.method, "DELETE");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      id: "message-456",
      fromMe: true,
      remoteJid: "5551999999999@s.whatsapp.net",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Z-API apaga usando messageId, telefone e owner na query", async () => {
  const { ZapiProvider } = await loadModule("lib/whatsapp/zapi.ts", "zapi-delete");
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 204 });
  };

  try {
    const provider = new ZapiProvider(
      account("zapi", { instance_id: "instance", token: "token", client_token: "client-token" }),
    );
    await provider.deleteMessage({
      to: "5551999999999",
      externalId: "message zapi",
      fromMe: true,
    });

    const url = new URL(calls[0].url);
    assert.equal(url.pathname, "/instances/instance/token/token/messages");
    assert.equal(url.searchParams.get("messageId"), "message zapi");
    assert.equal(url.searchParams.get("phone"), "5551999999999");
    assert.equal(url.searchParams.get("owner"), "true");
    assert.equal(calls[0].init.method, "DELETE");
    assert.equal(calls[0].init.headers["Client-Token"], "client-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
