#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const hoursArg = process.argv.find((arg) => arg.startsWith("--hours="));
const hours = Number(hoursArg?.slice("--hours=".length) || 48);
const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="));
const tenantSearch = tenantArg?.slice("--tenant=".length).trim().toLowerCase() || "";
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Number(limitArg?.slice("--limit=".length) || 30);
const queryArg = process.argv.find((arg) => arg.startsWith("--q="));
const messageSearch = queryArg?.slice("--q=".length).trim().toLowerCase() || "";
const duplicatesOnly = process.argv.includes("--duplicates-only");

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
    // optional
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function short(value) {
  return String(value ?? "").slice(0, 8);
}

function preview(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
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
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .order("name");
  if (tenantsError) throw new Error(tenantsError.message);

  const selectedTenants = (tenants ?? []).filter((tenant) => {
    if (!tenantSearch) return true;
    return (
      String(tenant.name ?? "").toLowerCase().includes(tenantSearch) ||
      String(tenant.slug ?? "").toLowerCase().includes(tenantSearch) ||
      String(tenant.id ?? "").toLowerCase().includes(tenantSearch)
    );
  });

  if (selectedTenants.length === 0) {
    console.log(`Nenhum tenant encontrado para "${tenantSearch}".`);
    return;
  }

  const tenantIds = selectedTenants.map((tenant) => tenant.id);
  const tenantById = new Map(selectedTenants.map((tenant) => [tenant.id, tenant]));

  const accounts = await fetchAll(
    "whatsapp_accounts",
    (query) =>
      query
        .select("id, tenant_id, provider, display_name, phone_number, credentials, is_active")
        .in("tenant_id", tenantIds)
        .order("created_at", { ascending: false }),
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const leads = await fetchAll(
    "leads",
    (query) =>
      query
        .select("id, tenant_id, name, phone, created_at, updated_at")
        .in("tenant_id", tenantIds)
        .gte("updated_at", since)
        .order("updated_at", { ascending: false }),
  );
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  const conversations = await fetchAll(
    "conversations",
    (query) =>
      query
        .select("id, tenant_id, lead_id, whatsapp_account_id, channel, last_message_at, unread_count")
        .in("tenant_id", tenantIds)
        .gte("last_message_at", since)
        .order("last_message_at", { ascending: false }),
  );
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const conversationIds = conversations.map((conversation) => conversation.id);

  const messages = [];
  for (let i = 0; i < conversationIds.length; i += 100) {
    const batch = conversationIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("messages")
      .select("id, tenant_id, conversation_id, direction, body, media_type, external_id, status, created_at")
      .in("conversation_id", batch)
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    messages.push(...(data ?? []));
  }

  console.log(`Janela: ultimas ${hours}h | tenants: ${selectedTenants.map((t) => t.name).join(", ")}`);
  console.log(`Contas: ${accounts.length} | Conversas recentes: ${conversations.length} | Mensagens recentes: ${messages.length}`);

  for (const tenant of selectedTenants) {
    console.log(`\n=== ${tenant.name} (${short(tenant.id)}) ===`);
    const tenantAccounts = accounts.filter((account) => account.tenant_id === tenant.id);
    for (const account of tenantAccounts) {
      const credentials = account.credentials ?? {};
      console.log(
        `Conta ${short(account.id)} active=${account.is_active} provider=${account.provider} ` +
          `display="${account.display_name ?? "-"}" phone=${account.phone_number ?? "-"} ` +
          `instance="${credentials.instance ?? credentials.instance_id ?? "-"}"`,
      );
    }

  const tenantMessages = messages.filter((message) => message.tenant_id === tenant.id);
    if (duplicatesOnly) continue;
    const filteredMessages = tenantMessages.filter((message) => {
      if (!messageSearch) return true;
      const conversation = conversationById.get(message.conversation_id);
      const lead = leadById.get(conversation?.lead_id);
      const account = accountById.get(conversation?.whatsapp_account_id);
      return [
        message.body,
        message.external_id,
        message.media_type,
        lead?.name,
        lead?.phone,
        account?.display_name,
        account?.phone_number,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(messageSearch));
    });
    for (const message of filteredMessages.slice(0, limit)) {
      const conversation = conversationById.get(message.conversation_id);
      const lead = leadById.get(conversation?.lead_id);
      const account = accountById.get(conversation?.whatsapp_account_id);
      console.log(
        `${message.created_at} ${message.direction}/${message.status} ` +
          `lead="${lead?.name ?? "-"}" phone=${lead?.phone ?? "-"} ` +
          `account="${account?.display_name ?? "-"}" ext=${message.external_id ?? "-"} ` +
          `${message.media_type ? `[${message.media_type}] ` : ""}"${preview(message.body)}"`,
      );
    }
  }

  const byExternal = new Map();
  for (const message of messages) {
    if (!message.external_id) continue;
    if (!byExternal.has(message.external_id)) byExternal.set(message.external_id, []);
    byExternal.get(message.external_id).push(message);
  }

  const duplicates = Array.from(byExternal.entries()).filter(([, rows]) => {
    return new Set(rows.map((row) => row.tenant_id)).size > 1;
  });

  if (duplicates.length > 0) {
    console.log(`\n=== External IDs duplicados entre tenants (${duplicates.length}) ===`);
    for (const [externalId, rows] of duplicates.slice(0, 50)) {
      console.log(`ext=${externalId}`);
      for (const row of rows) {
        const tenant = tenantById.get(row.tenant_id);
        const conversation = conversationById.get(row.conversation_id);
        const lead = leadById.get(conversation?.lead_id);
        console.log(`  - tenant=${tenant?.name ?? short(row.tenant_id)} msg=${short(row.id)} lead="${lead?.name ?? "-"}" "${preview(row.body)}"`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
