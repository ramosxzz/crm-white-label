import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/provider-error-message-test.mjs";
  await build({
    entryPoints: ["lib/chat/send-message-core.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { providerErrorMessage } = await loadModule();

test("prioriza a causa aninhada em vez de Internal Server Error", () => {
  const message = providerErrorMessage({
    status: "failed",
    raw: {
      error: "Internal Server Error",
      response: {
        message: ["Precondition Required", "Connection Closed"],
      },
    },
  });

  assert.equal(
    message,
    "A conexão deste número do WhatsApp está fechada. Reconecte a conta e tente novamente.",
  );
});

test("encontra Connection Closed dentro de um Bad Request da Evolution", () => {
  assert.equal(
    providerErrorMessage({
      status: "failed",
      raw: { status: 400, error: "Bad Request", response: { message: ["Error: Connection Closed"] } },
    }),
    "A conexão deste número do WhatsApp está fechada. Reconecte a conta e tente novamente.",
  );
});

test("mantem mensagem especifica devolvida pelo provedor", () => {
  assert.equal(
    providerErrorMessage({ status: "failed", raw: { error: { message: "Número inválido" } } }),
    "Número inválido",
  );
});

test("usa mensagem segura quando o provedor so devolve erro generico", () => {
  assert.equal(
    providerErrorMessage({ status: "failed", raw: { error: "Internal Server Error" } }),
    "Falha ao enviar mensagem pelo WhatsApp",
  );
});
