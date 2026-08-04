import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = `node_modules/.cache/spreadsheet-lead-import-${Date.now()}.mjs`;
  await build({
    entryPoints: ["lib/leads/spreadsheet-import.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(`${process.cwd()}/${outfile}`).href);
}

const { isDuplicateLeadPhoneError, prepareSpreadsheetLeads } = await loadModule();

test("telefone invalido vira null em vez de string vazia", () => {
  const result = prepareSpreadsheetLeads([
    { name: "Sem telefone", phone: "0000", source: "PAOLA MOVEIS" },
    { name: "Telefone vazio", phone: "" },
  ]);

  assert.equal(result.invalidPhones, 1);
  assert.deepEqual(result.rows.map((row) => row.phone), [null, null]);
});

test("remove telefone repetido dentro da mesma planilha", () => {
  const result = prepareSpreadsheetLeads([
    { name: "Carolina", phone: "(51) 9 9744-7067" },
    { name: "Carolina e Kelly", phone: "51997447067" },
    { name: "Outro lead", phone: "(51) 9 9276-9449" },
  ]);

  assert.equal(result.skippedDuplicates, 1);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.phone), ["5551997447067", "5551992769449"]);
});

test("identifica apenas a constraint unica de telefone do lead", () => {
  assert.equal(
    isDuplicateLeadPhoneError({ code: "23505", message: 'duplicate key violates "leads_tenant_phone_unique"' }),
    true,
  );
  assert.equal(isDuplicateLeadPhoneError({ code: "23505", message: "outra constraint" }), false);
  assert.equal(isDuplicateLeadPhoneError({ code: "42501", message: "RLS" }), false);
});
