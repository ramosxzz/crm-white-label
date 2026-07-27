#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const sinceArg = process.argv.find((arg) => arg.startsWith("--since="));
const since = sinceArg
  ? new Date(sinceArg.slice("--since=".length))
  : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const raw = trimmed.slice(idx + 1).trim();
      if (!key || process.env[key]) continue;
      process.env[key] = raw.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // optional env file
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function shortId(value) {
  return String(value ?? "").slice(0, 8);
}

function safeHost(value) {
  try {
    return new URL(String(value)).host;
  } catch {
    return String(value ?? "").replace(/^https?:\/\//, "").split("/")[0] || "-";
  }
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function collectByKeys(value, keys, out = []) {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectByKeys(item, keys, out);
    return out;
  }
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key) && typeof item === "string" && item.trim()) out.push(item.trim());
    if (item && typeof item === "object") collectByKeys(item, keys, out);
  }
  return out;
}

function extractInstanceCandidates(payload) {
  const raw = asObject(payload);
  const data = asObject(raw.data);
  const direct = [
    raw.instance,
    raw.instanceName,
    raw.instanceId,
    data.instance,
    data.instanceName,
    data.instanceId,
  ].filter((value) => typeof value === "string" && value.trim());
  const recursive = collectByKeys(payload, new Set(["instance", "instanceName", "instanceId"]));
  return Array.from(new Set([...direct, ...recursive].map((value) => String(value).trim()).filter(Boolean)));
}

function extractExternalIds(payload) {
  const ids = [];
  const raw = asObject(payload);
  const candidates = [
    raw.id,
    raw.messageId,
    asObject(raw.key).id,
    asObject(raw.data).id,
    asObject(raw.data).messageId,
    asObject(asObject(raw.data).key).id,
    asObject(asObject(raw.data).message).id,
    asObject(asObject(asObject(raw.data).message).key).id,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) ids.push(value.trim());
  }
  for (const value of collectByKeys(payload, new Set(["messageId"]))) ids.push(value);
  return Array.from(new Set(ids));
}

function accountIdentity(account) {
  const credentials = account.credentials ?? {};
  return [credentials.instance, credentials.instance_id]
    .map((value) => norm(value))
    .filter(Boolean);
}

function rowTenantName(tenantsById, tenantId) {
  const tenant = tenantsById.get(tenantId);
  return tenant ? `${tenant.name} (${shortId(tenant.id)})` : shortId(tenantId);
}

async function fetchAll(table, queryBuilder, pageSize = 1000) {
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await queryBuilder(supabase.from(table)).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  console.log(`Modo: ${apply ? "APLICAR LIMPEZA" : "dry-run"} | desde: ${since.toISOString()}`);

  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .order("name");
  if (tenantsError) throw new Error(tenantsError.message);
  const tenantsById = new Map((tenants ?? []).map((tenant) => [tenant.id, tenant]));

  const { data: accounts, error: accountsError } = await supabase
    .from("whatsapp_accounts")
    .select("id, tenant_id, provider, display_name, phone_number, credentials, is_active")
    .eq("provider", "evolution");
  if (accountsError) throw new Error(accountsError.message);

  const evolutionAccounts = accounts ?? [];
  const accountsById = new Map(evolutionAccounts.map((account) => [account.id, account]));
  console.log(`Contas Evolution encontradas: ${evolutionAccounts.length}`);
  for (const account of evolutionAccounts) {
    const credentials = account.credentials ?? {};
    console.log(
      `- ${shortId(account.id)} tenant=${rowTenantName(tenantsById, account.tenant_id)} active=${account.is_active} ` +
        `display="${account.display_name ?? "-"}" phone=${account.phone_number ?? "-"} ` +
        `instance="${credentials.instance ?? credentials.instance_id ?? "-"}" host=${safeHost(credentials.base_url)}`,
    );
  }

  const accountIds = evolutionAccounts.map((account) => account.id);
  if (accountIds.length === 0) return;

  const logs = await fetchAll(
    "whatsapp_webhook_logs",
    (query) =>
      query
        .select("id, tenant_id, whatsapp_account_id, event_type, payload, created_at")
        .in("whatsapp_account_id", accountIds)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
    1000,
  );

  const mismatches = [];
  const missingIdentity = [];
  for (const log of logs) {
    const account = accountsById.get(log.whatsapp_account_id);
    if (!account) continue;
    const expected = accountIdentity(account);
    const instances = extractInstanceCandidates(log.payload);
    const normalizedInstances = instances.map(norm).filter(Boolean);

    if (normalizedInstances.length === 0) {
      missingIdentity.push({ log, account });
      continue;
    }

    if (!normalizedInstances.some((candidate) => expected.includes(candidate))) {
      mismatches.push({
        log,
        account,
        expected,
        instances,
        externalIds: extractExternalIds(log.payload),
      });
    }
  }

  console.log(`Logs analisados: ${logs.length}`);
  console.log(`Logs sem instance/instanceId no payload: ${missingIdentity.length}`);
  console.log(`Logs com tenant/instancia divergente: ${mismatches.length}`);

  for (const item of mismatches.slice(0, 15)) {
    console.log(
      `! ${item.log.created_at} log=${shortId(item.log.id)} tenant_log=${rowTenantName(tenantsById, item.log.tenant_id)} ` +
        `account="${item.account.display_name ?? "-"}" expected=${item.expected.join("|") || "-"} ` +
        `payload_instance=${item.instances.join("|") || "-"} externalIds=${item.externalIds.length}`,
    );
  }

  const externalIds = Array.from(new Set(mismatches.flatMap((item) => item.externalIds))).filter(Boolean);
  if (externalIds.length === 0) {
    console.log("Nenhum external_id extraido dos logs divergentes. Nada para apagar automaticamente.");
    return;
  }

  const messagesToDelete = [];
  const wrongTenantIds = Array.from(new Set(mismatches.map((item) => item.log.tenant_id)));
  for (let i = 0; i < externalIds.length; i += 100) {
    const batch = externalIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("messages")
      .select("id, tenant_id, conversation_id, external_id, direction, body, created_at")
      .in("tenant_id", wrongTenantIds)
      .in("external_id", batch);
    if (error) throw new Error(`messages: ${error.message}`);
    messagesToDelete.push(...(data ?? []));
  }

  const uniqueMessages = Array.from(new Map(messagesToDelete.map((message) => [message.id, message])).values());
  const conversationIds = Array.from(new Set(uniqueMessages.map((message) => message.conversation_id).filter(Boolean)));
  console.log(`Mensagens vazadas localizadas por external_id: ${uniqueMessages.length}`);
  console.log(`Conversas afetadas: ${conversationIds.length}`);
  for (const message of uniqueMessages.slice(0, 20)) {
    const preview = String(message.body ?? "").replace(/\s+/g, " ").slice(0, 90);
    console.log(
      `- msg=${shortId(message.id)} tenant=${rowTenantName(tenantsById, message.tenant_id)} ` +
        `conv=${shortId(message.conversation_id)} ext=${message.external_id} ${message.direction} "${preview}"`,
    );
  }

  if (!apply) {
    console.log("Dry-run concluido. Para apagar essas mensagens, rode novamente com --apply.");
    return;
  }

  if (uniqueMessages.length > 0) {
    for (let i = 0; i < uniqueMessages.length; i += 100) {
      const batchIds = uniqueMessages.slice(i, i + 100).map((message) => message.id);
      const { error } = await supabase.from("messages").delete().in("id", batchIds);
      if (error) throw new Error(`delete messages: ${error.message}`);
    }
  }

  const emptyConversationIds = [];
  for (const conversationId of conversationIds) {
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    if (error) throw new Error(`count messages: ${error.message}`);
    if ((count ?? 0) === 0) emptyConversationIds.push(conversationId);
  }

  if (emptyConversationIds.length > 0) {
    for (let i = 0; i < emptyConversationIds.length; i += 100) {
      const batchIds = emptyConversationIds.slice(i, i + 100);
      const { error } = await supabase.from("conversations").delete().in("id", batchIds);
      if (error) throw new Error(`delete conversations: ${error.message}`);
    }
  }

  console.log(`Limpeza aplicada: ${uniqueMessages.length} mensagem(ns) apagada(s).`);
  console.log(`Conversas vazias apagadas: ${emptyConversationIds.length}.`);
  console.log("Logs de webhook foram preservados para auditoria.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
