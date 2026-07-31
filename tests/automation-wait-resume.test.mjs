import test from "node:test";
import assert from "node:assert/strict";

/**
 * Modela a caminhada de lib/automations/execute.ts pra uma cadencia
 * "mensagem -> espera -> mensagem -> espera -> mensagem".
 *
 * Motivo: o bloco "aguardar" nunca tinha sido usado em producao (zero passos
 * na base), e tinha dois defeitos que so apareceriam com a cadencia da Avante:
 *   1. retomar recomecava no gatilho e reenviava as mensagens ja enviadas;
 *   2. a execucao virava 'completed' ao pausar, e o cron nunca a retomava.
 * Este teste trava os dois.
 */
function walk(flow, state) {
  const nextOf = (id) => flow.filter((c) => c.from === id).map((c) => c.to);
  const sent = [];
  const visited = new Set();
  let pausedOnWait = false;
  const queue = nextOf("trigger");

  while (queue.length > 0) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    const kind = id.startsWith("wait") ? "wait" : "send";
    const prior = state.steps[id];

    if (prior === "done") {
      queue.push(...nextOf(id).filter((n) => !visited.has(n)));
      continue;
    }
    if (kind === "wait" && prior === "waiting") {
      pausedOnWait = true;
      continue;
    }
    if (kind === "wait" && prior === "pending") {
      state.steps[id] = "done";
      queue.push(...nextOf(id).filter((n) => !visited.has(n)));
      continue;
    }
    if (kind === "wait") {
      state.steps[id] = "waiting";
      pausedOnWait = true;
      continue;
    }

    sent.push(id);
    state.steps[id] = "done";
    queue.push(...nextOf(id).filter((n) => !visited.has(n)));
  }

  state.status = pausedOnWait ? "running" : "completed";
  return sent;
}

const CADENCIA = [
  { from: "trigger", to: "msg1" },
  { from: "msg1", to: "wait1" },
  { from: "wait1", to: "msg2" },
  { from: "msg2", to: "wait2" },
  { from: "wait2", to: "msg3" },
];

/** O cron destrava esperas cujo horario ja passou. */
function cronTick(state) {
  for (const [id, status] of Object.entries(state.steps)) {
    if (status === "waiting") state.steps[id] = "pending";
  }
}

test("cadencia envia uma mensagem por vez, sem repetir nenhuma", () => {
  const state = { steps: {}, status: "running" };

  assert.deepEqual(walk(CADENCIA, state), ["msg1"], "1a rodada manda so a primeira");
  assert.equal(state.status, "running", "pausada na espera, nao concluida");

  cronTick(state);
  assert.deepEqual(walk(CADENCIA, state), ["msg2"], "2a rodada manda so a segunda");
  assert.equal(state.status, "running");

  cronTick(state);
  assert.deepEqual(walk(CADENCIA, state), ["msg3"], "3a rodada manda so a terceira");
  assert.equal(state.status, "completed", "sem espera pendente, fecha");
});

test("cron rodando antes da hora nao avanca nem reenvia", () => {
  const state = { steps: {}, status: "running" };
  walk(CADENCIA, state);

  // Espera ainda nao venceu: o cron nao mexeu no passo.
  assert.deepEqual(walk(CADENCIA, state), [], "nada reenviado");
  assert.deepEqual(walk(CADENCIA, state), [], "nem na terceira passada");
  assert.equal(state.status, "running");
});

test("execucao pausada nunca fica presa como concluida", () => {
  const state = { steps: {}, status: "running" };
  walk(CADENCIA, state);
  // Era o bug: 'completed' aqui fazia processExecution recusar a retomada.
  assert.notEqual(state.status, "completed");
});

test("fluxo sem espera continua fechando normalmente", () => {
  const simples = [
    { from: "trigger", to: "msg1" },
    { from: "msg1", to: "msg2" },
  ];
  const state = { steps: {}, status: "running" };
  assert.deepEqual(walk(simples, state), ["msg1", "msg2"]);
  assert.equal(state.status, "completed");
});
