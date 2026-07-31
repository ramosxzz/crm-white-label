import test from "node:test";
import assert from "node:assert/strict";

/**
 * Janela de envio da cadencia (8h-21h de Brasilia).
 * Espelha lib/automations/sending-window.ts.
 *
 * Sem isso a cadencia manda de madrugada: os intervalos correm a partir da
 * entrada do lead, entao quem chega as 22h receberia a proxima a 1h.
 */
const START = 8;
const END = 21;

function brtHour(date) {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
  }).format(date);
  return Number(h) % 24;
}

function isWithin(date, start = START, end = END) {
  const hour = brtHour(date);
  return hour >= start && hour < end;
}

function nextOpening(from, start = START, end = END) {
  const cursor = new Date(from.getTime());
  cursor.setUTCMinutes(0, 0, 0);
  for (let i = 0; i <= 48; i++) {
    if (cursor.getTime() >= from.getTime() && isWithin(cursor, start, end)) return cursor;
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return from;
}

function deferUntil(now, start = START, end = END) {
  if (start >= end) return null;
  if (isWithin(now, start, end)) return null;
  return nextOpening(now, start, end);
}

/** Monta um instante pelo horario de Brasilia (UTC-3). */
const brt = (dia, hora) => new Date(Date.UTC(2026, 6, dia, hora + 3, 0, 0));

test("dentro do horario comercial envia na hora", () => {
  assert.equal(deferUntil(brt(15, 9)), null);
  assert.equal(deferUntil(brt(15, 14)), null);
  assert.equal(deferUntil(brt(15, 20)), null, "20h59 ainda e horario valido");
});

test("madrugada segura ate as 8h do mesmo dia", () => {
  const adiado = deferUntil(brt(15, 1));
  assert.ok(adiado, "1h da manha precisa ser adiada");
  assert.equal(brtHour(adiado), START);
  assert.equal(adiado.getUTCDate(), 15, "abre ainda no mesmo dia");
});

test("depois do fechamento vai pro dia seguinte", () => {
  const adiado = deferUntil(brt(15, 22));
  assert.ok(adiado);
  assert.equal(brtHour(adiado), START);
  assert.equal(adiado.getUTCDate(), 16, "22h so pode sair amanha");
});

test("as bordas sao exatas", () => {
  assert.equal(isWithin(brt(15, 7)), false, "7h ainda nao abriu");
  assert.equal(isWithin(brt(15, 8)), true, "8h em ponto ja abriu");
  assert.equal(isWithin(brt(15, 20)), true, "20h ainda vale");
  assert.equal(isWithin(brt(15, 21)), false, "21h em ponto ja fechou");
});

test("a janela usa Brasilia, nao o fuso do servidor", () => {
  // 23h UTC = 20h em Brasilia: valido, mesmo parecendo tarde em UTC.
  const vinteBRT = new Date(Date.UTC(2026, 6, 15, 23, 0, 0));
  assert.equal(brtHour(vinteBRT), 20);
  assert.equal(deferUntil(vinteBRT), null);

  // 10h UTC = 7h em Brasilia: ainda fechado, mesmo parecendo dia em UTC.
  const seteBRT = new Date(Date.UTC(2026, 6, 15, 10, 0, 0));
  assert.equal(brtHour(seteBRT), 7);
  assert.ok(deferUntil(seteBRT), "7h da manha ainda segura");
});

test("janela invalida nao prende a mensagem pra sempre", () => {
  // Se alguem digitar 21 ate 8, nao da pra adiar - melhor enviar que sumir.
  assert.equal(deferUntil(brt(15, 3), 21, 8), null);
});

test("a mensagem e adiada, nunca descartada", () => {
  // O contrato: fora da janela sempre existe um horario futuro de saida.
  for (const hora of [0, 2, 5, 7, 21, 22, 23]) {
    const adiado = deferUntil(brt(15, hora));
    assert.ok(adiado, `${hora}h deveria ser adiada`);
    assert.ok(isWithin(adiado), `${hora}h caiu fora da janela ao reabrir`);
  }
});
