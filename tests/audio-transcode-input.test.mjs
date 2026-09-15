import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/audio-transcode-input-test.mjs";
  await build({
    entryPoints: ["lib/media/transcode-audio.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href);
}

test("remove fragmento anterior que aparece antes do cabecalho WebM", async () => {
  const { stripLeadingWebmFragment } = await loadModule();
  const header = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  const validWebm = Buffer.concat([header, Buffer.from("audio")]);
  const recovered = stripLeadingWebmFragment(Buffer.concat([Buffer.from("fragmento antigo"), validWebm]));
  assert.deepEqual(recovered, validWebm);
});

test("preserva arquivo que ja comeca com cabecalho WebM", async () => {
  const { stripLeadingWebmFragment } = await loadModule();
  const validWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86]);
  assert.strictEqual(stripLeadingWebmFragment(validWebm), validWebm);
});

test("nao altera outros formatos de audio", async () => {
  const { stripLeadingWebmFragment } = await loadModule();
  const ogg = Buffer.from("OggS-audio");
  assert.strictEqual(stripLeadingWebmFragment(ogg), ogg);
});
