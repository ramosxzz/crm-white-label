import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/webhook-account-match-test.mjs";
  await build({
    entryPoints: ["lib/whatsapp/webhook-account-match.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

function account(overrides = {}) {
  return {
    id: "acc-1",
    tenant_id: "tenant-1",
    phone_number: "5551999990000",
    credentials: {},
    ...overrides,
  };
}

test("cloud_api: no accounts match -> null (never guesses)", async () => {
  const { matchCloudApiAccount } = await loadModule();
  const accounts = [account({ id: "a", tenant_id: "t1", credentials: { phone_number_id: "111" } })];
  const result = matchCloudApiAccount(accounts, { phone_number_id: "999" });
  assert.equal(result, null);
});

test("cloud_api: matches by phone_number_id", async () => {
  const { matchCloudApiAccount } = await loadModule();
  const accounts = [
    account({ id: "a", tenant_id: "t1", credentials: { phone_number_id: "111" } }),
    account({ id: "b", tenant_id: "t2", credentials: { phone_number_id: "222" } }),
  ];
  const result = matchCloudApiAccount(accounts, { phone_number_id: "222" });
  assert.equal(result.id, "b");
});

test("cloud_api: ambiguous match (same phone_number_id on 2 accounts) -> null", async () => {
  const { matchCloudApiAccount } = await loadModule();
  const accounts = [
    account({ id: "a", tenant_id: "t1", credentials: { phone_number_id: "111" } }),
    account({ id: "b", tenant_id: "t2", credentials: { phone_number_id: "111" } }),
  ];
  const result = matchCloudApiAccount(accounts, { phone_number_id: "111" });
  assert.equal(result, null);
});

test("zapi: no instanceId in payload -> null", async () => {
  const { matchZapiAccount } = await loadModule();
  const accounts = [account({ credentials: { instance_id: "abc" } })];
  assert.equal(matchZapiAccount(accounts, undefined), null);
});

test("zapi: matches by instance_id", async () => {
  const { matchZapiAccount } = await loadModule();
  const accounts = [
    account({ id: "a", credentials: { instance_id: "abc" } }),
    account({ id: "b", credentials: { instance_id: "xyz" } }),
  ];
  assert.equal(matchZapiAccount(accounts, "XYZ").id, "b");
});

test("evolution: no instance candidates -> null (payload ignored)", async () => {
  const { matchEvolutionAccount } = await loadModule();
  const accounts = [account({ credentials: { instance: "loja-a" } })];
  const result = matchEvolutionAccount(accounts, { instanceCandidates: [] });
  assert.equal(result, null);
});

test("evolution: matches by instance name", async () => {
  const { matchEvolutionAccount } = await loadModule();
  const accounts = [
    account({ id: "a", tenant_id: "avante", credentials: { instance: "avante-digital" } }),
    account({ id: "b", tenant_id: "atacado", credentials: { instance: "atacado-moda-sul" } }),
  ];
  const result = matchEvolutionAccount(accounts, { instanceCandidates: ["avante-digital"] });
  assert.equal(result.id, "a");
});

test("evolution: two tenants never collide by phone suffix or shared api key alone", async () => {
  // Regressao do vazamento real: Avante Digital x Atacado Moda Sul. Instancias
  // diferentes, sem overlap de api_key/base_url usado como match principal.
  const { matchEvolutionAccount } = await loadModule();
  const accounts = [
    account({ id: "avante", tenant_id: "avante", credentials: { instance: "avante-digital", api_key: "shared-key" } }),
    account({ id: "atacado", tenant_id: "atacado", credentials: { instance: "atacado-moda-sul", api_key: "shared-key" } }),
  ];
  const result = matchEvolutionAccount(accounts, { instanceCandidates: ["atacado-moda-sul"], apikey: "shared-key" });
  assert.equal(result.id, "atacado");
});

test("evolution: ambiguous instance match narrowed by api_key", async () => {
  const { matchEvolutionAccount } = await loadModule();
  const accounts = [
    account({ id: "a", credentials: { instance: "shared-instance", api_key: "key-a" } }),
    account({ id: "b", credentials: { instance: "shared-instance", api_key: "key-b" } }),
  ];
  const result = matchEvolutionAccount(accounts, { instanceCandidates: ["shared-instance"], apikey: "key-b" });
  assert.equal(result.id, "b");
});

test("isCrossTenantDuplicate: same tenant is not a duplicate to block", async () => {
  const { isCrossTenantDuplicate } = await loadModule();
  assert.equal(isCrossTenantDuplicate({ tenant_id: "t1" }, "t1"), false);
});

test("isCrossTenantDuplicate: different tenant is blocked (prevents cross-tenant leak)", async () => {
  const { isCrossTenantDuplicate } = await loadModule();
  assert.equal(isCrossTenantDuplicate({ tenant_id: "t1" }, "t2"), true);
});

test("isCrossTenantDuplicate: no existing message is not a duplicate", async () => {
  const { isCrossTenantDuplicate } = await loadModule();
  assert.equal(isCrossTenantDuplicate(null, "t1"), false);
  assert.equal(isCrossTenantDuplicate(undefined, "t1"), false);
});
