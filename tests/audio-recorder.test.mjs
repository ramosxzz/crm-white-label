import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/audio-recorder-test.mjs";
  await build({
    entryPoints: ["lib/media/audio-recorder.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href);
}

test("preserva o MIME WebM real e usa a extensao correspondente", async () => {
  const { buildRecordedAudio } = await loadModule();
  const result = buildRecordedAudio(
    { mimeType: "audio/webm;codecs=opus" },
    [new Blob(["audio"], { type: "audio/webm;codecs=opus" })],
    123,
  );
  assert.equal(result.mimeType, "audio/webm;codecs=opus");
  assert.equal(result.blob.type, "audio/webm;codecs=opus");
  assert.equal(result.fileName, "audio-123.webm");
});

test("usa OGG apenas quando o navegador realmente grava OGG", async () => {
  const { buildRecordedAudio, preferredAudioRecorderMimeType } = await loadModule();
  assert.equal(
    preferredAudioRecorderMimeType((mime) => mime === "audio/ogg;codecs=opus"),
    "audio/ogg;codecs=opus",
  );
  const result = buildRecordedAudio(
    { mimeType: "audio/ogg;codecs=opus" },
    [new Blob(["audio"])],
    456,
  );
  assert.equal(result.fileName, "audio-456.ogg");
});
