import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/brand-colors-test.mjs";
  await build({
    entryPoints: ["lib/theme/brand-colors.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

test("escolhe foreground escuro para uma marca amarela clara", async () => {
  const { tenantBrandCssVars } = await loadModule();
  const vars = tenantBrandCssVars("#FFD700", "light");
  assert.equal(vars["--brand-foreground"], "0 0% 0%");
  assert.equal(vars["--chat-outbound-foreground"], "0 0% 0%");
  assert.match(vars["--chat-outbound-meta"], / 16%$/);
});

test("preserva o hue da empresa e cria destaque legivel nos dois temas", async () => {
  const { tenantBrandCssVars } = await loadModule();
  for (const color of ["#7C3AED", "#2563EB", "#16A34A", "#DC2626", "#EA580C", "#FFD700"]) {
    const light = tenantBrandCssVars(color, "light");
    const dark = tenantBrandCssVars(color, "dark");
    assert.match(light["--brand"], /^\d+ \d+% \d+(?:\.\d+)?%$/);
    assert.match(dark["--brand-active"], /^\d+ \d+% (?:6[2-9]|[7-9]\d|100)%$/);
    assert.ok(["0 0% 0%", "0 0% 100%"].includes(light["--brand-foreground"]));
    assert.ok(["0 0% 0%", "0 0% 100%"].includes(dark["--brand-foreground"]));
  }
});
