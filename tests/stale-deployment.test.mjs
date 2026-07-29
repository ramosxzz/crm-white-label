import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/stale-deployment-test.mjs";
  await build({
    entryPoints: ["lib/stale-deployment.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { isStaleDeploymentError } = await loadModule();

function named(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

test("reconhece Server Action de uma versao anterior", () => {
  assert.equal(isStaleDeploymentError(new Error("Failed to find Server Action 'abc'")), true);
  assert.equal(isStaleDeploymentError(new Error("The action was not found on the server")), true);
});

test("reconhece chunk que sumiu depois do deploy", () => {
  // O webpack poe a identificacao no name, nao na mensagem.
  assert.equal(isStaleDeploymentError(named("ChunkLoadError", "Loading chunk 493 failed.")), true);
  assert.equal(
    isStaleDeploymentError(new Error("Failed to fetch dynamically imported module: /_next/x.js")),
    true,
  );
  assert.equal(
    isStaleDeploymentError(new Error("error loading dynamically imported module")),
    true,
  );
  assert.equal(isStaleDeploymentError(new Error("Importing a module script failed.")), true);
});

test("nao confunde erro comum com bundle velho", () => {
  assert.equal(isStaleDeploymentError(new Error("Cannot read properties of undefined")), false);
  assert.equal(isStaleDeploymentError(new Error("Sem permissao para acessar")), false);
  assert.equal(isStaleDeploymentError(new TypeError("x is not a function")), false);
});

test("aguenta erro sem mensagem, sem name e nulo", () => {
  assert.equal(isStaleDeploymentError(new Error()), false);
  assert.equal(isStaleDeploymentError(null), false);
  assert.equal(isStaleDeploymentError(undefined), false);
});
