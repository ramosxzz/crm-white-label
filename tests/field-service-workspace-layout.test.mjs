import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("workspace admact nao reserva uma linha vazia entre itens e registros", async () => {
  const source = await readFile("app/(app)/os/[id]/page.tsx", "utf8");

  assert.doesNotMatch(
    source,
    /min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1/,
  );
  assert.match(source, /min-w-0 xl:col-start-2 xl:row-start-2/);
});

test("agenda resolve consultores pela mesma lista usada na OS completa", async () => {
  const source = await readFile("app/(app)/os/agenda/page.tsx", "utf8");

  assert.match(source, /consultantNameById = new Map\([\s\S]*consultants\.map/);
  assert.match(source, /consultantExtraName:/);
});

test("acerto acompanha os valores atualizados recebidos do servidor", async () => {
  const source = await readFile(
    "app/(app)/os/[id]/settlement-panel.tsx",
    "utf8",
  );

  assert.match(source, /useEffect\(\(\) => \{\s*setExpected/);
  assert.match(source, /expectedCents > 0 \? expectedCents : totalCents/);
});

test("administrativo ACT nao pode iniciar a execucao da OS", async () => {
  const source = await readFile("app/(app)/os/[id]/page.tsx", "utf8");

  assert.match(source, /hideStatuses=.*komodusWorkspace.*"em_execucao"/s);
});

test("roteiro do administrativo ACT mantem apenas a acao de imprimir", async () => {
  const source = await readFile("app/(app)/os/roteiro/page.tsx", "utf8");

  assert.match(
    source,
    /const komodusWorkspace = usesKomodusServiceOrderWorkspace\(ctx\)/,
  );
  assert.match(source, /!komodusWorkspace && \([\s\S]*<>/);
});
