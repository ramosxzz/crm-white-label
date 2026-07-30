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

test("normaliza número internacional explícito sem forçar o DDI 55", async () => {
  const { normalizeWhatsAppPhone, isValidWhatsAppPhone } = await loadModule(
    "lib/whatsapp/phone.ts",
    "international-phone",
  );

  assert.equal(normalizeWhatsAppPhone("+1 (617) 750-8340"), "16177508340");
  assert.equal(normalizeWhatsAppPhone("16177508340"), "16177508340");
  assert.equal(isValidWhatsAppPhone("16177508340"), true);
});

test("mantém a normalização brasileira para números locais", async () => {
  const { normalizeWhatsAppPhone, isValidBrazilWhatsAppPhone } = await loadModule(
    "lib/whatsapp/phone.ts",
    "brazil-phone",
  );

  assert.equal(normalizeWhatsAppPhone("(51) 98044-6961"), "5551980446961");
  assert.equal(isValidBrazilWhatsAppPhone("5551980446961"), true);
});

test("não usa chaves brasileiras por sufixo para números internacionais", async () => {
  const { phoneMatchKeys, phonesEquivalent } = await loadModule(
    "lib/whatsapp/phone.ts",
    "international-phone-match",
  );

  assert.deepEqual(phoneMatchKeys("+1 (617) 750-8340"), ["16177508340"]);
  assert.equal(phonesEquivalent("+1 (617) 750-8340", "16177508340"), true);
  assert.equal(phonesEquivalent("+1 (617) 750-8340", "6177508340"), false);
});

test("resolve contato internacional recebido pela Z-API", async () => {
  const { resolveZapiContact } = await loadModule(
    "lib/whatsapp/contact-ref.ts",
    "international-zapi-contact",
  );

  assert.deepEqual(
    resolveZapiContact(
      {
        phone: "16177508340",
        connectedPhone: "5551999999999",
        fromMe: false,
      },
      false,
      "5551999999999",
    ),
    { phone: "16177508340", lid: null },
  );
});

test("lista de conversas não esconde telefone de fora do Brasil", async () => {
  const { filterConversationRows } = await loadModule(
    "lib/chat/conversation-filter.ts",
    "international-conversation-filter",
  );

  const rows = [
    {
      id: "conversation-us",
      lead_id: "lead-us",
      channel: "whatsapp",
      last_message_at: "2026-07-30T15:00:00.000Z",
      unread_count: 1,
      leads: {
        name: "Cliente EUA",
        phone: "16177508340",
      },
    },
  ];

  assert.deepEqual(
    filterConversationRows(rows, null).map((row) => row.id),
    ["conversation-us"],
  );
});
