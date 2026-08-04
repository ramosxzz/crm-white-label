import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import * as XLSX from "xlsx";

async function loadModule(entryPoint, name) {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = `node_modules/.cache/${name}-${Date.now()}.mjs`;
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(`${process.cwd()}/${outfile}`).href);
}

function workbookBuffer(bookType) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Nome do Cliente", "WhatsApp", "E-mail", "Origem do Lead"],
    ["Ana Silva", "5551999999999", "ana@example.com", "Indicacao"],
    ["Bruno Souza", "5551888888888", "bruno@example.com", "Instagram"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  const data = XLSX.write(workbook, { bookType, type: "array" });
  return data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

test("reconhece cabecalhos comuns sem precisar chamar IA", async () => {
  const { heuristicCsvMapping, isReliableCsvMapping } = await loadModule(
    "lib/leads/spreadsheet-mapping.ts",
    "spreadsheet-mapping",
  );

  const mapping = heuristicCsvMapping(["NOME_DO_CLIENTE", "WhatsApp", "E-mail", "Origem do Lead"]);
  assert.deepEqual(mapping, {
    name: "NOME_DO_CLIENTE",
    phone: "WhatsApp",
    email: "E-mail",
    source: "Origem do Lead",
  });
  assert.equal(isReliableCsvMapping(mapping), true);
});

for (const bookType of ["xlsx", "xls"]) {
  test(`le a primeira aba de um arquivo ${bookType.toUpperCase()}`, async () => {
    const { parseExcelBuffer } = await loadModule(
      "lib/leads/spreadsheet-file.ts",
      `spreadsheet-${bookType}`,
    );

    const parsed = await parseExcelBuffer(workbookBuffer(bookType));
    assert.deepEqual(parsed.headers, ["Nome do Cliente", "WhatsApp", "E-mail", "Origem do Lead"]);
    assert.deepEqual(parsed.rows[0], {
      "Nome do Cliente": "Ana Silva",
      WhatsApp: "5551999999999",
      "E-mail": "ana@example.com",
      "Origem do Lead": "Indicacao",
    });
    assert.equal(parsed.rows.length, 2);
  });
}

test("mapeamento conhecido ignora a rede mesmo com IA configurada", async () => {
  const originalKey = process.env.AI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.AI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("nao deveria chamar a rede");
  };

  try {
    const { suggestCsvMapping } = await loadModule("lib/ai/csv-mapping.ts", "spreadsheet-ai-skip");
    const mapping = await suggestCsvMapping(["Nome", "Telefone", "Email"], []);
    assert.equal(mapping.name, "Nome");
    assert.equal(mapping.phone, "Telefone");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
  }
});

test("usa IA apenas para cabecalhos ambiguos e valida a resposta", async () => {
  const originalKey = process.env.AI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.AI_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    assert.ok(init.signal);
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"name":"Pessoa","phone":"Contato principal","email":null,"source":null}',
            },
          },
        ],
      }),
    };
  };

  try {
    const { suggestCsvMapping } = await loadModule("lib/ai/csv-mapping.ts", "spreadsheet-ai-use");
    const mapping = await suggestCsvMapping(
      ["Pessoa", "Contato principal"],
      [{ Pessoa: "Ana", "Contato principal": "5551999999999" }],
    );
    assert.deepEqual(mapping, {
      name: "Pessoa",
      phone: "Contato principal",
      email: null,
      source: null,
    });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
  }
});
