import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-workspace-access-test.mjs";
  await build({
    entryPoints: ["lib/field-service/workspace-access.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(`${process.cwd()}/${outfile}`).href + `?v=${Date.now()}`);
}

test("ativa o workspace Komodus somente para a conta com acesso exclusivo a OS", async () => {
  const { usesKomodusServiceOrderWorkspace } = await loadModule();

  assert.equal(usesKomodusServiceOrderWorkspace({ osOnlyAccess: true }), true);
  assert.equal(usesKomodusServiceOrderWorkspace({ osOnlyAccess: false }), false);
});

test("todas as superficies Komodus consultam a permissao do usuario", async () => {
  const files = [
    "app/(app)/os/page.tsx",
    "app/(app)/os/agenda/page.tsx",
    "app/(app)/os/[id]/page.tsx",
    "app/(app)/os/[id]/print/page.tsx",
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.match(source, /usesKomodusServiceOrderWorkspace\(ctx\)/, file);
  }
});
