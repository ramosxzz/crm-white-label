import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/evolution-groups-test.mjs";
  await build({
    entryPoints: ["lib/whatsapp/evolution-groups.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href);
}

test("normalizes GROUPS_UPSERT list payloads", async () => {
  const { parseEvolutionGroupEvents } = await loadModule();

  const groups = parseEvolutionGroupEvents({
    event: "GROUPS_UPSERT",
    data: [
      {
        id: "120363000000000000@g.us",
        subject: "Clientes VIP",
        subjectOwner: "555199999999@s.whatsapp.net",
        subjectTime: 1710000000,
        participants: [{ id: "555188888888@s.whatsapp.net" }],
      },
    ],
  });

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0], {
    provider_group_id: "120363000000000000@g.us",
    subject: "Clientes VIP",
    description: null,
    owner_jid: "555199999999@s.whatsapp.net",
    participant_count: 1,
    last_event_type: "GROUPS_UPSERT",
    last_event_at: "2024-03-09T16:00:00.000Z",
    raw_payload: {
      id: "120363000000000000@g.us",
      subject: "Clientes VIP",
      subjectOwner: "555199999999@s.whatsapp.net",
      subjectTime: 1710000000,
      participants: [{ id: "555188888888@s.whatsapp.net" }],
    },
  });
});

test("normalizes single GROUP_UPDATE payloads", async () => {
  const { parseEvolutionGroupEvents } = await loadModule();

  const groups = parseEvolutionGroupEvents({
    event: "GROUP_UPDATE",
    data: {
      id: "120363111111111111@g.us",
      subject: "Equipe Comercial",
      desc: "Negociacoes ativas",
      owner: "555177777777@s.whatsapp.net",
    },
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].provider_group_id, "120363111111111111@g.us");
  assert.equal(groups[0].subject, "Equipe Comercial");
  assert.equal(groups[0].description, "Negociacoes ativas");
  assert.equal(groups[0].owner_jid, "555177777777@s.whatsapp.net");
  assert.equal(groups[0].participant_count, null);
  assert.equal(groups[0].last_event_type, "GROUP_UPDATE");
});

test("accepts dotted group event names", async () => {
  const { parseEvolutionGroupEvents } = await loadModule();
  const groups = parseEvolutionGroupEvents({
    event: "groups.upsert",
    data: { id: "120363222222222222@g.us", subject: "Pos-venda" },
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].last_event_type, "GROUPS_UPSERT");
});
