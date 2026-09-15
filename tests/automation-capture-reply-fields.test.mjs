import test from "node:test";
import assert from "node:assert/strict";

/**
 * Extracao de campos rotulados da resposta do lead + trava de "so libera o
 * proximo passo (rodizio/confirmacao) quando TODOS os campos vieram".
 * Espelha lib/automations/execute.ts (acao capture_reply_fields).
 *
 * Existe por causa de um incidente real na 2L Reboques: a primeira mensagem
 * do lead (que ainda nem respondeu o formulario) ja disparava o rodizio e a
 * mensagem de confirmacao, porque so se checava "o rodizio rodou", nunca se
 * o lead realmente preencheu nome/cidade/modelo antes disso.
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLabeledFields(body, fields) {
  const captured = {};
  for (const f of fields) {
    const label = String(f.label ?? "").trim();
    const customField = String(f.custom_field ?? "").trim();
    if (!label || !customField) continue;
    const match = body.match(new RegExp(`${escapeRegex(label)}[^:\\n\\r]*:\\s*([^\\n\\r]+)`, "i"));
    const value = match?.[1]?.trim();
    if (value) captured[customField] = value;
  }
  const configuredFieldCount = fields.filter((f) => f.label?.trim() && f.custom_field?.trim()).length;
  return { captured, allFieldsMatched: Object.keys(captured).length === configuredFieldCount };
}

const FIELDS_2L_REBOQUES = [
  { label: "Nome", custom_field: "nome_cliente" },
  { label: "Cidade/Estado", custom_field: "cidade_estado" },
  { label: "Modelo de reboque", custom_field: "modelo_reboque" },
];

test("resposta completa no formato do formulario extrai os 3 campos e libera o proximo passo", () => {
  const body = [
    "Nome: Pri",
    "Cidade/Estado: Brasília/DF",
    "Modelo de reboque que você procura: engate para bike",
  ].join("\n");

  const { captured, allFieldsMatched } = extractLabeledFields(body, FIELDS_2L_REBOQUES);
  assert.deepEqual(captured, {
    nome_cliente: "Pri",
    cidade_estado: "Brasília/DF",
    modelo_reboque: "engate para bike",
  });
  assert.equal(allFieldsMatched, true);
});

test("mensagem generica sem os rotulos nao captura nada e nao libera o proximo passo", () => {
  // Caso real: "Olá! Tenho interesse e queria mais informações, por favor."
  const body = "Olá! Tenho interesse e queria mais informações, por favor.";
  const { captured, allFieldsMatched } = extractLabeledFields(body, FIELDS_2L_REBOQUES);
  assert.deepEqual(captured, {});
  assert.equal(allFieldsMatched, false);
});

test("resposta parcial (faltando um campo) nao libera o proximo passo", () => {
  const body = "Nome: Valcir\nCidade/Estado: Blumenau/SC";
  const { captured, allFieldsMatched } = extractLabeledFields(body, FIELDS_2L_REBOQUES);
  assert.equal(Object.keys(captured).length, 2);
  assert.equal(allFieldsMatched, false, "faltou modelo de reboque - nao pode assumir qualificado");
});

test("uma unica mensagem que so cita 'nome' de passagem nao basta sozinha", () => {
  const body = "Vc faz reboque assim, porém menor pra engate em bike?";
  const { allFieldsMatched } = extractLabeledFields(body, FIELDS_2L_REBOQUES);
  assert.equal(allFieldsMatched, false);
});

test("rotulo com texto extra antes dos dois-pontos ainda casa", () => {
  // Pergunta original era "Modelo de reboque que você procura:", lead reduziu.
  const body = "Nome: João\nCidade/Estado: SP\nModelo de reboque: reboque utilitário";
  const { captured, allFieldsMatched } = extractLabeledFields(body, FIELDS_2L_REBOQUES);
  assert.equal(captured.modelo_reboque, "reboque utilitário");
  assert.equal(allFieldsMatched, true);
});
