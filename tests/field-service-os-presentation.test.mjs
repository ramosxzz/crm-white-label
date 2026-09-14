import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-os-presentation-test.mjs";
  await build({
    entryPoints: ["lib/field-service/os-presentation.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(`${process.cwd()}/${outfile}`).href + `?v=${Date.now()}`);
}

test("monta endereco ACT sem separadores vazios", async () => {
  const { formatOperationalAddress } = await loadModule();
  assert.equal(
    formatOperationalAddress({
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "Sapucaia do Sul",
      state: "RS",
    }),
    "Rua A, 10 · Centro · Sapucaia do Sul/RS",
  );
  assert.equal(formatOperationalAddress({ city: "Canoas", state: "RS" }), "Canoas/RS");
});

test("resume itens e preserva quantidade", async () => {
  const { summarizeServiceItems } = await loadModule();
  assert.deepEqual(
    summarizeServiceItems(
      [
        { quantity: 2, description: "Sofá 3 lugares" },
        { quantity: 1, description: "Poltrona" },
        { quantity: 4, description: "Cadeira" },
      ],
      2,
    ),
    ["2x Sofá 3 lugares", "1x Poltrona"],
  );
});

test("formata janela exata no fuso de Brasilia", async () => {
  const { formatOperationalWindow } = await loadModule();
  assert.equal(
    formatOperationalWindow("2026-09-12T11:30:00Z", "2026-09-12T13:30:00Z"),
    "08:30–10:30",
  );
  assert.equal(formatOperationalWindow(null, null), "Horário não definido");
});
