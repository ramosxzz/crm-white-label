import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
const { outputFiles } = await build({
  entryPoints: ["lib/async/timeout-fetch.ts"], bundle: true, write: false, platform: "node", format: "esm",
});
const { createTimeoutFetch } = await import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
test("preserva cancelamento explicito do chamador", async () => {
  const controller = new AbortController();
  let signal;
  await createTimeoutFetch(1000, async (_input, init) => { signal = init.signal; return new Response(); })("/", {signal: controller.signal});
  controller.abort();
  assert.equal(signal.aborted, true);
});
test("preserva cancelamento de um Request", async () => {
  const controller = new AbortController();
  let signal;
  await createTimeoutFetch(1000, async (_input, init) => { signal = init.signal; return new Response(); })(new Request("https://example.com", {signal: controller.signal}));
  controller.abort();
  assert.equal(signal.aborted, true);
});
test("interrompe requisicao travada pelo prazo", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const wrapped = createTimeoutFetch(10, async (_input, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {once:true});
    }));
    await assert.rejects(wrapped("/"), {name:"TimeoutError"});
  } finally { clearTimeout(keepAlive); }
});
