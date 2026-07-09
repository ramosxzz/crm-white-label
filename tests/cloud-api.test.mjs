import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/cloud-api-test.mjs";
  await build({
    entryPoints: ["lib/whatsapp/cloud-api.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href);
}

test("normalizes Meta Cloud API messages and statuses", async () => {
  const { CloudApiProvider } = await loadModule();
  const provider = new CloudApiProvider({
    credentials: { phone_number_id: "123", access_token: "token" },
  });

  const messages = provider.parseWebhook({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                display_phone_number: "555199999999",
                phone_number_id: "123",
              },
              contacts: [
                {
                  wa_id: "5551980446961",
                  profile: { name: "Cliente Teste" },
                },
              ],
              messages: [
                {
                  id: "wamid.text",
                  from: "5551980446961",
                  timestamp: "1710000000",
                  type: "text",
                  text: { body: "Oi" },
                },
                {
                  id: "wamid.audio",
                  from: "5551980446961",
                  timestamp: "1710000001",
                  type: "audio",
                  audio: { id: "media-audio", mime_type: "audio/ogg" },
                },
              ],
              statuses: [
                {
                  id: "wamid.sent",
                  recipient_id: "5551980446961",
                  status: "delivered",
                  timestamp: "1710000002",
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(messages.length, 3);
  const text = messages.find((message) => message.externalId === "wamid.text");
  const audio = messages.find((message) => message.externalId === "wamid.audio");
  const status = messages.find((message) => message.externalId === "wamid.sent");
  assert.equal(text.body, "Oi");
  assert.equal(text.contactName, "Cliente Teste");
  assert.equal(text.contactPhone, "5551980446961");
  assert.equal(audio.body, "🎤 Áudio");
  assert.equal(audio.mediaUrl, "cloud_api:media-audio");
  assert.equal(audio.mediaMimeType, "audio/ogg");
  assert.equal(status.direction, "outbound");
  assert.equal(status.messageStatus, "delivered");
});
