import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-commissions-test.mjs";
  await build({
    entryPoints: ["lib/field-service/commissions.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

const RULES = { tecnicoPercent: 10, vendedoraInternaPercent: 1, lojaParceiraPercent: 5 };

function input(overrides) {
  return {
    totalCents: 0,
    approvedUpsellCents: 0,
    technicianIds: [],
    consultantId: null,
    partnerStore: null,
    rules: RULES,
    ...overrides,
  };
}

test("tecnico comissiona so sobre o upsell, nunca sobre o servico da venda", async () => {
  const { calculateCommissions } = await loadModule();
  // OS de R$578: R$379 fechados pela vendedora + R$199 vendidos em campo.
  const lines = calculateCommissions(
    input({ totalCents: 57800, approvedUpsellCents: 19900, technicianIds: ["tec-1"] }),
  );
  const tecnico = lines.find((line) => line.partyKind === "tecnico");
  assert.equal(tecnico.baseCents, 19900);
  assert.equal(tecnico.amountCents, 1990);
});

test("OS sem venda em campo nao gera comissao de tecnico", async () => {
  const { calculateCommissions } = await loadModule();
  const lines = calculateCommissions(
    input({ totalCents: 37900, approvedUpsellCents: 0, technicianIds: ["tec-1", "tec-2"] }),
  );
  assert.equal(
    lines.filter((line) => line.partyKind === "tecnico").length,
    0,
  );
});

test("upsell nao aprovado nao entra: base zero nao comissiona", async () => {
  const { calculateCommissions } = await loadModule();
  // approvedUpsellCents e a soma SO do que o ADM liberou na conferencia.
  const lines = calculateCommissions(
    input({ totalCents: 37900, approvedUpsellCents: 0, technicianIds: ["tec-1"] }),
  );
  assert.equal(lines.some((line) => line.partyKind === "tecnico"), false);
});

test("dupla na mesma residencia divide a comissao do upsell", async () => {
  const { calculateCommissions } = await loadModule();
  const lines = calculateCommissions(
    input({ totalCents: 57800, approvedUpsellCents: 20000, technicianIds: ["tec-1", "tec-2"] }),
  );
  const tecnicos = lines.filter((line) => line.partyKind === "tecnico");
  assert.equal(tecnicos.length, 2);
  assert.equal(tecnicos[0].amountCents, 1000);
  assert.equal(tecnicos[1].amountCents, 1000);
});

test("divisao entre 3 tecnicos nao perde nem cria centavo", async () => {
  const { calculateCommissions, splitCents } = await loadModule();
  // 10% de 19900 = 1990 centavos; 1990/3 nao e exato.
  const lines = calculateCommissions(
    input({
      totalCents: 57800,
      approvedUpsellCents: 19900,
      technicianIds: ["tec-1", "tec-2", "tec-3"],
    }),
  );
  const tecnicos = lines.filter((line) => line.partyKind === "tecnico");
  const soma = tecnicos.reduce((acc, line) => acc + line.amountCents, 0);
  assert.equal(soma, 1990);
  assert.deepEqual(tecnicos.map((line) => line.amountCents), [664, 663, 663]);
  assert.deepEqual(splitCents(10, 3), [4, 3, 3]);
  assert.equal(splitCents(100, 4).reduce((a, b) => a + b, 0), 100);
});

test("vendedora interna comissiona 1% sobre o total da OS", async () => {
  const { calculateCommissions } = await loadModule();
  const lines = calculateCommissions(
    input({ totalCents: 57800, consultantId: "vend-1" }),
  );
  const vendedora = lines.find((line) => line.partyKind === "vendedora_interna");
  assert.equal(vendedora.baseCents, 57800);
  assert.equal(vendedora.amountCents, 578);
  assert.equal(vendedora.userId, "vend-1");
});

test("loja parceira so entra quando a OS veio por indicacao", async () => {
  const { calculateCommissions } = await loadModule();
  const sem = calculateCommissions(input({ totalCents: 57800, partnerStore: null }));
  assert.equal(sem.some((line) => line.partyKind === "loja_parceira"), false);

  const comEspacoEmBranco = calculateCommissions(
    input({ totalCents: 57800, partnerStore: "   " }),
  );
  assert.equal(comEspacoEmBranco.some((line) => line.partyKind === "loja_parceira"), false);

  const com = calculateCommissions(
    input({ totalCents: 57800, partnerStore: "Loja Centro" }),
  );
  const parceira = com.find((line) => line.partyKind === "loja_parceira");
  assert.equal(parceira.partnerName, "Loja Centro");
  assert.equal(parceira.userId, null);
  assert.equal(parceira.amountCents, 2890);
});

test("OS completa gera as tres partes de uma vez", async () => {
  const { calculateCommissions, totalCommissionCents } = await loadModule();
  const lines = calculateCommissions(
    input({
      totalCents: 57800,
      approvedUpsellCents: 19900,
      technicianIds: ["tec-1"],
      consultantId: "vend-1",
      partnerStore: "Loja Centro",
    }),
  );
  assert.deepEqual(
    lines.map((line) => line.partyKind),
    ["tecnico", "vendedora_interna", "loja_parceira"],
  );
  // 1990 + 578 + 2890
  assert.equal(totalCommissionCents(lines), 5458);
});

test("percentual zerado nas regras nao cria linha de comissao", async () => {
  const { calculateCommissions } = await loadModule();
  const lines = calculateCommissions(
    input({
      totalCents: 57800,
      approvedUpsellCents: 19900,
      technicianIds: ["tec-1"],
      consultantId: "vend-1",
      rules: { tecnicoPercent: 0, vendedoraInternaPercent: 0, lojaParceiraPercent: 0 },
    }),
  );
  assert.deepEqual(lines, []);
});
