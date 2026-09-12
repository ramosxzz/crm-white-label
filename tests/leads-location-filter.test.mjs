import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

await mkdir("node_modules/.cache", { recursive: true });
const outfile = "node_modules/.cache/leads-location-filter-test.mjs";
await build({
  entryPoints: ["lib/leads/location-filter.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});

const {
  VASOS_FORTUNA_TENANT_ID,
  canFilterLeadsByLocation,
  normalizeLeadLocationFilter,
} = await import(`${pathToFileURL(`${process.cwd()}/${outfile}`).href}?t=${Date.now()}`);

test("filtro de endereco aparece somente para o tenant Vasos Fortuna", () => {
  assert.equal(VASOS_FORTUNA_TENANT_ID, "fd0f666f-e303-4694-aa51-1190740c3d12");
  assert.equal(canFilterLeadsByLocation(VASOS_FORTUNA_TENANT_ID), true);
  assert.equal(canFilterLeadsByLocation("00000000-0000-0000-0000-000000000000"), false);
});

test("normaliza a busca de endereco ou cidade antes de consultar", () => {
  assert.equal(normalizeLeadLocationFilter(undefined), null);
  assert.equal(normalizeLeadLocationFilter("   "), null);
  assert.equal(normalizeLeadLocationFilter("  Campo    Bom  "), "Campo Bom");
  assert.equal(normalizeLeadLocationFilter("x".repeat(140)), "x".repeat(120));
});

test("pagina de leads aplica localizacao nas consultas, contagens e paginacao", async () => {
  const source = await readFile("app/(app)/leads/page.tsx", "utf8");

  assert.match(source, /localizacao\?: string/);
  assert.match(source, /normalizeLeadLocationFilter\(params\?\.localizacao\)/);
  assert.match(source, /useDirectCount = Boolean\([^;]*locationFilter/s);
  assert.match(source, /\.ilike\("custom_fields->>address", `%\$\{locationFilter\}%`\)/);
  assert.equal((source.match(/custom_fields->>address/g) ?? []).length, 2);
  assert.match(source, /qs\.set\("localizacao", locationFilter\)/);
  assert.match(source, /showLocationFilter=\{canFilterLeadsByLocation\(ctx\.tenantId\)\}/);
});

test("interface oferece busca Endereco ou cidade somente quando habilitada", async () => {
  const source = await readFile("app/(app)/leads/leads-filters.tsx", "utf8");

  assert.match(source, /showLocationFilter: boolean/);
  assert.match(source, /searchParams\.get\("localizacao"\)/);
  assert.match(source, /placeholder="Buscar por endereço ou cidade\.\.\."/);
  assert.match(source, /label: `Localização: \$\{locationValue\}`/);
  assert.match(source, /qs\.set\("localizacao", locationValue\.trim\(\)\)/);
});
