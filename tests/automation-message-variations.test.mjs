import test from "node:test";
import assert from "node:assert/strict";

/**
 * Espelha a escolha de variacao de lib/automations/execute.ts (send_message).
 * O executor real depende de Supabase/WhatsApp; o que importa testar aqui e a
 * regra de qual texto sai, que e o que a Avante pediu.
 */
function pickMessage(blockConfig, random = Math.random) {
  const variations = Array.isArray(blockConfig.message_variations)
    ? blockConfig.message_variations.map((v) => String(v ?? "").trim()).filter(Boolean)
    : [];
  const pool = variations.length > 0 ? variations : [String(blockConfig.message ?? "")];
  return pool[Math.floor(random() * pool.length)];
}

test("sem variacao configurada, manda a mensagem unica de sempre", () => {
  const cfg = { message: "Ola {name}!" };
  assert.equal(pickMessage(cfg), "Ola {name}!");
});

test("fluxo antigo (sem o campo novo) segue funcionando", () => {
  assert.equal(pickMessage({ message: "texto legado" }), "texto legado");
});

test("com 3 variacoes, todas podem sair", () => {
  const cfg = { message: "A", message_variations: ["A", "B", "C"] };
  assert.equal(pickMessage(cfg, () => 0), "A");
  assert.equal(pickMessage(cfg, () => 0.5), "B");
  assert.equal(pickMessage(cfg, () => 0.99), "C");
});

test("caixa de variacao vazia nao vira mensagem em branco", () => {
  // A UI guarda vazias pra caixa nao sumir enquanto se digita; quem descarta
  // e o executor. Sem isso o lead receberia mensagem vazia.
  const cfg = { message: "A", message_variations: ["A", "", "   ", "B"] };
  for (const r of [0, 0.4, 0.6, 0.99]) {
    const picked = pickMessage(cfg, () => r);
    assert.ok(picked.trim().length > 0, `sorteou vazio com random=${r}`);
    assert.ok(["A", "B"].includes(picked));
  }
});

test("todas as variacoes vazias cai na mensagem principal", () => {
  const cfg = { message: "principal", message_variations: ["", "  "] };
  assert.equal(pickMessage(cfg), "principal");
});

test("uma variacao so sempre sai ela", () => {
  const cfg = { message: "X", message_variations: ["unica"] };
  for (const r of [0, 0.33, 0.99]) assert.equal(pickMessage(cfg, () => r), "unica");
});
