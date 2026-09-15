import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("modal de reuniao respeita a viewport e mantem a acao acessivel", async () => {
  const source = await readFile("components/leads/schedule-meeting-button.tsx", "utf8");

  assert.match(source, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(source, /overflow-y-auto overscroll-contain/);
  assert.match(source, /DialogFooter className="shrink-0/);
  assert.match(source, /type="submit"/);
});

test("lista de disponibilidade possui rolagem propria", async () => {
  const source = await readFile("components/leads/meeting-mini-agenda.tsx", "utf8");

  assert.match(source, /max-h-64/);
  assert.match(source, /overflow-y-auto overscroll-contain/);
});
