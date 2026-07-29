#!/usr/bin/env node
/**
 * Preenche retroativamente de qual criativo veio cada lead, usando o emoji da
 * primeira mensagem recebida e as regras ja cadastradas em
 * `ad_creative_signatures`.
 *
 * Roda em modo simulacao por padrao: sem --apply ele so mostra o que faria.
 *
 *   node scripts/backfill-ad-signatures.mjs --tenant <uuid> [--days 30] [--apply]
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente
 * (o .env.local ja tem os dois).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // sem .env.local, segue com o que estiver no ambiente
  }
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function loadMatcher() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/ad-signature-backfill.mjs";
  await build({
    entryPoints: ["lib/meta/ad-signature.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

loadEnvLocal();

const tenantId = arg("tenant");
const days = Number(arg("days", "30"));
const apply = process.argv.includes("--apply");

if (!tenantId) {
  console.error("Informe --tenant <uuid>.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { matchAdCreative, isMediaPlaceholder } = await loadMatcher();

const META_AD_ID_KEYS = [
  "meta_ad_id",
  "meta_source_id",
  "ad_id",
  "source_id",
  "ctwa_ad_id",
  "whatsapp_ad_id",
];
const hasAdAttribution = (fields) =>
  !!fields &&
  META_AD_ID_KEYS.some((k) => (typeof fields[k] === "string" ? fields[k].trim() !== "" : fields[k] != null));

const { data: ruleRows, error: ruleErr } = await supabase
  .from("ad_creative_signatures")
  .select("id, emoji, match_text, creative_name, ad_id, active")
  .eq("tenant_id", tenantId)
  .eq("active", true);
if (ruleErr) throw new Error(ruleErr.message);

const rules = (ruleRows ?? []).map((r) => ({
  id: r.id,
  emoji: r.emoji ?? "",
  matchText: r.match_text ?? null,
  creativeName: r.creative_name ?? "",
  adId: r.ad_id ?? null,
  active: r.active !== false,
}));

if (rules.length === 0) {
  console.error("Nenhuma regra cadastrada para esse tenant. Cadastre em Configuracoes primeiro.");
  process.exit(1);
}
console.log(`${rules.length} regra(s) ativa(s).`);

const since = new Date();
since.setDate(since.getDate() - days);

/**
 * O PostgREST corta a resposta em ~1000 linhas independente do `limit`, e como
 * a ordem e crescente o corte descartaria justamente as conversas mais
 * recentes. Sem paginar, o backfill silenciosamente ignora a maior parte do
 * periodo - foi o que aconteceu na primeira execucao.
 */
async function fetchAllPages(buildQuery, pageSize = 1000) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}

// Primeira mensagem recebida de cada conversa, que e a que carrega a origem.
const msgs = await fetchAllPages(() =>
  supabase
    .from("messages")
    .select("conversation_id, body, created_at")
    .eq("tenant_id", tenantId)
    .eq("direction", "inbound")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true }),
);

const firstByConversation = new Map();
for (const m of msgs ?? []) {
  if (!m.conversation_id || firstByConversation.has(m.conversation_id)) continue;
  firstByConversation.set(m.conversation_id, m.body ?? "");
}
console.log(`${firstByConversation.size} conversa(s) no periodo de ${days} dias.`);

// Em lotes: uma clausula `in` com milhares de ids estoura o tamanho da URL.
const conversationIds = [...firstByConversation.keys()];
const convs = [];
for (let i = 0; i < conversationIds.length; i += 300) {
  const slice = conversationIds.slice(i, i + 300);
  const { data, error } = await supabase
    .from("conversations")
    .select("id, lead_id")
    .eq("tenant_id", tenantId)
    .in("id", slice);
  if (error) throw new Error(error.message);
  convs.push(...(data ?? []));
}

const leadIds = [...new Set(convs.map((c) => c.lead_id).filter(Boolean))];
const leadById = new Map();
// Lotes pequenos e erro checado: com 500 ids a URL estoura e a resposta volta
// vazia sem erro visivel, o que fazia o backfill pular a maioria dos leads.
for (let i = 0; i < leadIds.length; i += 200) {
  const { data, error } = await supabase
    .from("leads")
    .select("id, custom_fields")
    .eq("tenant_id", tenantId)
    .in("id", leadIds.slice(i, i + 200));
  if (error) throw new Error(`Falha ao carregar leads: ${error.message}`);
  for (const l of data ?? []) leadById.set(l.id, l);
}
if (leadById.size < leadIds.length) {
  console.warn(`Aviso: ${leadIds.length - leadById.size} lead(s) das conversas nao foram encontrados.`);
}

const porCriativo = new Map();
let jaAtribuidos = 0;
let semMatch = 0;
let midia = 0;
const updates = [];

for (const conv of convs ?? []) {
  const body = firstByConversation.get(conv.id) ?? "";
  const lead = leadById.get(conv.lead_id);
  if (!lead) continue;

  const fields = lead.custom_fields ?? {};
  if (hasAdAttribution(fields)) {
    jaAtribuidos += 1;
    continue;
  }
  if (isMediaPlaceholder(body)) {
    midia += 1;
    continue;
  }

  const match = matchAdCreative(rules, body);
  if (!match) {
    semMatch += 1;
    continue;
  }

  porCriativo.set(match.creativeName, (porCriativo.get(match.creativeName) ?? 0) + 1);
  const next = {
    ...fields,
    meta_creative_name: match.creativeName,
    meta_ad_signature_emoji: match.emoji,
    meta_attribution_source: "emoji_signature_backfill",
    meta_referral_captured_at: new Date().toISOString(),
  };
  if (match.adId && match.adId.trim()) next.meta_ad_id = match.adId.trim();
  updates.push({ id: lead.id, custom_fields: next });
}

console.log("");
console.log(`Atribuiveis .......... ${updates.length}`);
console.log(`Ja tinham origem ..... ${jaAtribuidos}`);
console.log(`Sem emoji conhecido .. ${semMatch}`);
console.log(`Midia (ignorados) .... ${midia}`);
console.log("");
for (const [nome, qtd] of [...porCriativo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(qtd).padStart(4)}  ${nome}`);
}

if (!apply) {
  console.log("\nSimulacao. Rode de novo com --apply para gravar.");
  process.exit(0);
}

let gravados = 0;
for (const u of updates) {
  const { error } = await supabase
    .from("leads")
    .update({ custom_fields: u.custom_fields })
    .eq("id", u.id)
    .eq("tenant_id", tenantId);
  if (error) console.error(`Falha no lead ${u.id}: ${error.message}`);
  else gravados += 1;
}
console.log(`\n${gravados} lead(s) atualizado(s).`);
