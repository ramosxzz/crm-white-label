import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

await mkdir("node_modules/.cache", { recursive: true });
const outfile = `node_modules/.cache/broadcast-leads-${Date.now()}.mjs`;
await build({
  entryPoints: ["lib/disparos/broadcast-leads.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  logLevel: "silent",
});
const { filterBroadcastLeads, formatBroadcastPhone, hasContactName, latestImportTimestamp } = await import(
  pathToFileURL(`${process.cwd()}/${outfile}`).href
);

const leads = [
  { id: "1", name: "ALICE", phone: "5551992769449", source: "PAOLA MOVEIS", created_at: "2026-08-04T17:07:43.000Z" },
  { id: "2", name: "BRUNA", phone: "5551990000001", source: "PAOLA MOVEIS", created_at: "2026-08-04T17:07:43.000Z" },
  { id: "3", name: "555192670286", phone: "555192670286", source: "whatsapp", created_at: "2026-08-04T16:00:00.000Z" },
];

test("identifica nome real e nome que e apenas telefone", () => {
  assert.equal(hasContactName(leads[0]), true);
  assert.equal(hasContactName(leads[2]), false);
});

test("formata telefone brasileiro para conferencia", () => {
  assert.equal(formatBroadcastPhone("5551992769449"), "+55 (51) 99276-9449");
  assert.equal(formatBroadcastPhone("555192670286"), "+55 (51) 9267-0286");
});

test("detecta e filtra a ultima importacao em lote", () => {
  const timestamp = latestImportTimestamp(leads);
  assert.equal(timestamp, "2026-08-04T17:07:43.000Z");
  assert.deepEqual(
    filterBroadcastLeads(leads, {
      search: "",
      source: "all",
      period: "latest_import",
      latestImport: timestamp,
      now: new Date("2026-08-04T18:00:00.000Z"),
    }).map((lead) => lead.id),
    ["1", "2"],
  );
});

test("combina busca, periodo e origem", () => {
  assert.deepEqual(
    filterBroadcastLeads(leads, {
      search: "alice",
      source: "PAOLA MOVEIS",
      period: "today",
      now: new Date("2026-08-04T18:00:00.000Z"),
    }).map((lead) => lead.id),
    ["1"],
  );
});
