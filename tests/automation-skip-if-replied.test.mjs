import test from "node:test";
import assert from "node:assert/strict";

/**
 * Trava "nao enviar se o lead ja respondeu" (lib/automations/execute.ts).
 *
 * Numa cadencia automatica isso e o que separa acompanhamento de robo
 * insistente: quem respondeu na 2a mensagem nao pode receber a 3a e a 4a.
 * O desligamento por lead (automations_enabled) nao cobre isso - ele so e
 * lido quando a automacao dispara, nao a cada passo de uma execucao em curso.
 */
function shouldSkip(blockConfig, { startedAt, inboundAt }) {
  if (!blockConfig.skip_if_replied) return false;
  if (!startedAt) return false;
  return inboundAt.some((t) => t > startedAt);
}

const INICIO = "2026-07-30T10:00:00Z";

test("sem a trava ligada, envia mesmo se o lead respondeu", () => {
  const cfg = { message: "oi" };
  assert.equal(shouldSkip(cfg, { startedAt: INICIO, inboundAt: ["2026-07-30T11:00:00Z"] }), false);
});

test("lead respondeu depois do inicio: nao envia", () => {
  const cfg = { skip_if_replied: true };
  assert.equal(shouldSkip(cfg, { startedAt: INICIO, inboundAt: ["2026-07-30T11:00:00Z"] }), true);
});

test("lead nao respondeu: segue enviando", () => {
  const cfg = { skip_if_replied: true };
  assert.equal(shouldSkip(cfg, { startedAt: INICIO, inboundAt: [] }), false);
});

test("mensagem antiga do lead nao interrompe a cadencia nova", () => {
  // Conversa de semanas atras nao pode cancelar uma cadencia que comecou hoje.
  const cfg = { skip_if_replied: true };
  assert.equal(shouldSkip(cfg, { startedAt: INICIO, inboundAt: ["2026-07-01T09:00:00Z"] }), false);
});

test("basta uma resposta no meio de varias mensagens antigas", () => {
  const cfg = { skip_if_replied: true };
  const inbound = ["2026-07-01T09:00:00Z", "2026-07-30T10:30:00Z", "2026-07-02T09:00:00Z"];
  assert.equal(shouldSkip(cfg, { startedAt: INICIO, inboundAt: inbound }), true);
});

test("sem marco de inicio, nao bloqueia o envio", () => {
  // Execucao antiga sem started_at: melhor enviar do que travar a cadencia.
  const cfg = { skip_if_replied: true };
  assert.equal(shouldSkip(cfg, { startedAt: null, inboundAt: ["2026-07-30T11:00:00Z"] }), false);
});
