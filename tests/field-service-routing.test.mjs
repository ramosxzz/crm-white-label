import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/field-service-routing-test.mjs";
  await build({
    entryPoints: ["lib/field-service/routing.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
  });
  return import(pathToFileURL(process.cwd() + "/" + outfile).href + `?v=${Date.now()}`);
}

test("monta o endereco completo pro geocoding", async () => {
  const { buildAddressQuery } = await loadModule();
  const query = buildAddressQuery({
    address_street: "Rua Candido Silveira",
    address_number: "95",
    address_district: "Auxiliadora",
    address_city: "Porto Alegre",
    address_state: "RS",
    address_cep: "90540010",
  });
  assert.equal(
    query,
    "Rua Candido Silveira, 95, Auxiliadora, Porto Alegre, RS, 90540010, Brasil",
  );
});

test("recusa endereco incompleto em vez de gastar chamada paga", async () => {
  const { buildAddressQuery } = await loadModule();
  // Sem rua o Google devolveria o centroide da cidade, o que colocaria a
  // parada no lugar errado dentro da rota.
  assert.equal(buildAddressQuery({ address_city: "Porto Alegre" }), null);
  assert.equal(buildAddressQuery({}), null);
  // So a rua, sem nenhuma outra referencia, tambem nao serve.
  assert.equal(buildAddressQuery({ address_street: "Rua Candido Silveira" }), null);
});

test("aceita endereco sem CEP desde que tenha bairro ou cidade", async () => {
  const { buildAddressQuery } = await loadModule();
  assert.equal(
    buildAddressQuery({ address_street: "Rua Marechal Deodoro", address_city: "Sapucaia do Sul" }),
    "Rua Marechal Deodoro, Sapucaia do Sul, Brasil",
  );
});

test("formata distancia em metros e quilometros", async () => {
  const { formatDistance } = await loadModule();
  assert.equal(formatDistance(480), "480 m");
  assert.equal(formatDistance(1000), "1,0 km");
  assert.equal(formatDistance(12340), "12,3 km");
});

test("formata duracao em minutos e horas", async () => {
  const { formatDuration } = await loadModule();
  assert.equal(formatDuration(300), "5 min");
  assert.equal(formatDuration(3600), "1h00");
  assert.equal(formatDuration(5400), "1h30");
});

test("link de navegacao prefere coordenada ao texto do endereco", async () => {
  const { navigationLink } = await loadModule();
  const withCoords = navigationLink({ lat: -30.02, lng: -51.19 }, "Rua X");
  assert.ok(withCoords.includes("destination=-30.02,-51.19"));

  const withAddress = navigationLink({ lat: null, lng: null }, "Rua X, 10");
  assert.ok(withAddress.includes(encodeURIComponent("Rua X, 10")));

  assert.equal(navigationLink({ lat: null, lng: null }, null), null);
});

test("roteirizacao fica desligada sem a chave no servidor", async () => {
  const { isRoutingEnabled } = await loadModule();
  const previous = process.env.GOOGLE_MAPS_API_KEY;

  delete process.env.GOOGLE_MAPS_API_KEY;
  assert.equal(isRoutingEnabled(), false);

  process.env.GOOGLE_MAPS_API_KEY = "chave-de-teste";
  assert.equal(isRoutingEnabled(), true);

  if (previous === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = previous;
});

test("nao chama o Google sem chave configurada", async () => {
  const { geocodeAddress } = await loadModule();
  const previous = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;

  await assert.rejects(() => geocodeAddress("Rua X"), /GOOGLE_MAPS_API_KEY/);

  if (previous !== undefined) process.env.GOOGLE_MAPS_API_KEY = previous;
});
