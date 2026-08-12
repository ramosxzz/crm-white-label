import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("filtro de estrelas troca localmente sem Link, router ou ancora", async () => {
  const source = await readFile("components/dashboard/leads-quality-card.tsx", "utf8");
  assert.match(source, /^"use client";/);
  assert.match(source, /setActive\(period\)/);
  assert.match(source, /window\.history\.replaceState/);
  assert.doesNotMatch(source, /<Link/);
  assert.doesNotMatch(source, /router\.(push|replace)/);
  assert.doesNotMatch(source, /#estrelas/);
});
