import test from "node:test";
import assert from "node:assert/strict";

/**
 * O som de notificacao (components/chat/conversation-list-live.tsx) escuta
 * INSERT em `messages` filtrando so por tenant_id - o Postgres Changes nao
 * enxerga a regra de "quem pode ver qual conversa" (numero de outro
 * vendedor, numero exclusivo do administrador). Sem o corte por conversa
 * visivel, o som tocava pra QUALQUER mensagem do tenant inteiro.
 */
function shouldPlaySound(row, visibleConversationIds) {
  if (row?.direction !== "inbound") return false;
  if (!row.conversation_id) return false;
  return visibleConversationIds.has(row.conversation_id);
}

test("mensagem de conversa visivel toca o som", () => {
  const visible = new Set(["conv-a", "conv-b"]);
  assert.equal(shouldPlaySound({ direction: "inbound", conversation_id: "conv-a" }, visible), true);
});

test("mensagem de conversa de outro vendedor nao toca - o bug relatado", () => {
  // Caso real: vendedora ouvindo o som de mensagem que caiu pro administrador.
  const visible = new Set(["conv-da-vendedora"]);
  assert.equal(
    shouldPlaySound({ direction: "inbound", conversation_id: "conv-do-admin" }, visible),
    false,
  );
});

test("mensagem enviada por nos (outbound) nunca toca, mesmo em conversa visivel", () => {
  const visible = new Set(["conv-a"]);
  assert.equal(shouldPlaySound({ direction: "outbound", conversation_id: "conv-a" }, visible), false);
});

test("payload sem conversation_id nao toca", () => {
  const visible = new Set(["conv-a"]);
  assert.equal(shouldPlaySound({ direction: "inbound" }, visible), false);
});

test("gestao (visibilidade nula na origem) enxerga tudo, entao o set contem tudo", () => {
  // buildChatAccountVisibility retorna null pra quem ve tudo; a lista de items
  // que alimenta o set, nesse caso, ja vem sem filtro nenhum do servidor.
  const visible = new Set(["conv-a", "conv-b", "conv-c"]);
  for (const id of visible) {
    assert.equal(shouldPlaySound({ direction: "inbound", conversation_id: id }, visible), true);
  }
});
