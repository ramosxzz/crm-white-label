import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/media-limits-test.mjs";
  await build({
    entryPoints: ["lib/whatsapp/media-limits.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { mediaSizeError, formatMegabytes, WHATSAPP_MEDIA_LIMITS_BYTES } = await loadModule();

test("video de celular grande e recusado antes de subir", () => {
  const err = mediaSizeError("video", 300 * 1024 * 1024);
  assert.ok(err, "deveria recusar video de 300MB");
  assert.match(err, /16 MB/);
  assert.match(err, /300 MB/);
});

test("video dentro do limite passa", () => {
  assert.equal(mediaSizeError("video", 10 * 1024 * 1024), null);
  assert.equal(mediaSizeError("video", WHATSAPP_MEDIA_LIMITS_BYTES.video), null);
});

test("documento aceita ate 100MB, video nao", () => {
  assert.equal(mediaSizeError("document", 90 * 1024 * 1024), null);
  assert.ok(mediaSizeError("video", 90 * 1024 * 1024));
});

test("formatMegabytes arredonda acima de 10MB e mostra decimal abaixo", () => {
  assert.equal(formatMegabytes(16 * 1024 * 1024), "16 MB");
  assert.equal(formatMegabytes(1.5 * 1024 * 1024), "1.5 MB");
});
