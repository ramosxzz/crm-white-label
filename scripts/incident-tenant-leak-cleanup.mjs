#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const hoursArg = process.argv.find((arg) => arg.startsWith("--hours="));
const hours = Number(hoursArg?.slice("--hours=".length) || 24);
const apply = process.argv.includes("--apply");
const deleteLeads = process.argv.includes("--delete-leads");
const summaryOnly = process.argv.includes("--summary-only");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const listLimit = Number(limitArg?.slice("--limit=".length) || 80);
const wrongTenantSearch =
  process.argv.find((arg) => arg.startsWith("--wrong-tenant="))?.slice("--wrong-tenant=".length).toLowerCase() ||
  "atacado";
const sourceTenantSearch =
  process.argv.find((arg) => arg.startsWith("--source-tenant="))?.slice("--source-tenant=".length).toLowerCase() ||
  "avante";

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

function matchesTenant(tenant, search) {
  return [tenant.name, tenant.slug, tenant.id].some((value) => String(value ?? "").toLowerCase().includes(search));
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

async function getTenant(search, label) {
  const { data, error } = await supabase.from("tenants").select("id, name, slug").order("name");
  if (error) throw new Error(error.message);
  const matches = (data ?? []).filter((tenant) => matchesTenant(tenant, search));
  if (matches.length !== 1) {
    throw new Error(`${label}: esperado 1 tenant para "${search}", encontrado ${matches.length}.`);
  }
  return matches[0];
}

async function main() {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const wrongTenant = await getTenant(wrongTenantSearch, "Tenant errado");
  const sourceTenant = await getTenant(sourceTenantSearch, "Tenant correto");

  const sourceMessages = await fetchAll(
    "messages",
    (query) =>
      query
        .select("id, external_id")
        .eq("tenant_id", sourceTenant.id)
        .not("external_id", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
  );
  const sourceExternalIds = new Set(sourceMessages.map((message) => message.external_id).filter(Boolean));

  const wrongMessages = await fetchAll(
    "messages",
    (query) =>
      query
        .select("id, tenant_id, conversation_id, direction, body, media_type, external_id, status, created_at")
        .eq("tenant_id", wrongTenant.id)
        .not("external_id", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
  );

  const leakedMessages = wrongMessages.filter((message) => sourceExternalIds.has(message.external_id));
  const leakedConversationIds = Array.from(new Set(leakedMessages.map((message) => message.conversation_id).filter(Boolean)));

  const conversations = leakedConversationIds.length
    ? await fetchAll(
        "conversations",
        (query) =>
          query
            .select("id, tenant_id, lead_id, whatsapp_account_id, channel, last_message_at")
            .eq("tenant_id", wrongTenant.id)
            .in("id", leakedConversationIds),
      )
    : [];
  const conversationById = new Map(conversations.map((conversation) => [conversation.id, conversation]));

  const leadIds = Array.from(new Set(conversations.map((conversation) => conversation.lead_id).filter(Boolean)));
  const leads = leadIds.length
    ? await fetchAll(
        "leads",
        (query) => query.select("id, tenant_id, name, phone, created_at, updated_at").eq("tenant_id", wrongTenant.id).in("id", leadIds),
      )
    : [];
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  const remainingMessagesByConversation = new Map();
  for (const conversationId of leakedConversationIds) {
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", wrongTenant.id)
      .eq("conversation_id", conversationId)
      .not("id", "in", `(${leakedMessages.filter((message) => message.conversation_id === conversationId).map((message) => message.id).join(",")})`);
    if (error) throw new Error(error.message);
    remainingMessagesByConversation.set(conversationId, count ?? 0);
  }

  const emptyConversationIds = leakedConversationIds.filter((id) => remainingMessagesByConversation.get(id) === 0);
  const deletableLeadIds = [];
  if (deleteLeads && emptyConversationIds.length > 0) {
    for (const lead of leads) {
      const { count, error } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", wrongTenant.id)
        .eq("lead_id", lead.id)
        .not("id", "in", `(${emptyConversationIds.join(",")})`);
      if (error) throw new Error(error.message);
      if ((count ?? 0) === 0) deletableLeadIds.push(lead.id);
    }
  }

  console.log(`${apply ? "APLICANDO" : "DRY-RUN"} limpeza de vazamento`);
  console.log(`Tenant correto: ${sourceTenant.name} (${short(sourceTenant.id)})`);
  console.log(`Tenant errado: ${wrongTenant.name} (${short(wrongTenant.id)})`);
  console.log(`Janela: ultimas ${hours}h`);
  console.log(`Mensagens duplicadas/vazadas no tenant errado: ${leakedMessages.length}`);
  console.log(`Conversas afetadas: ${leakedConversationIds.length}`);
  console.log(`Conversas que ficarao vazias: ${emptyConversationIds.length}`);
  console.log(`Leads que seriam removidos (--delete-leads): ${deletableLeadIds.length}`);

  if (!summaryOnly) {
    for (const message of leakedMessages.slice(0, listLimit)) {
      const conversation = conversationById.get(message.conversation_id);
      const lead = leadById.get(conversation?.lead_id);
      console.log(
        `${message.created_at} msg=${short(message.id)} lead="${lead?.name ?? "-"}" phone=${lead?.phone ?? "-"} ` +
          `ext=${message.external_id} ${message.media_type ? `[${message.media_type}] ` : ""}"${preview(message.body)}"`,
      );
    }
    if (leakedMessages.length > listLimit) {
      console.log(`... ${leakedMessages.length - listLimit} mensagens ocultas. Use --limit=N ou --summary-only.`);
    }
  }

  if (!apply) {
    console.log("\nNada foi apagado. Rode com --apply para excluir somente estes registros.");
    return;
  }

  if (leakedMessages.length > 0) {
    const ids = leakedMessages.map((message) => message.id);
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from("messages").delete().in("id", ids.slice(i, i + 100)).eq("tenant_id", wrongTenant.id);
      if (error) throw new Error(error.message);
    }
  }

  if (emptyConversationIds.length > 0) {
    for (let i = 0; i < emptyConversationIds.length; i += 100) {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .in("id", emptyConversationIds.slice(i, i + 100))
        .eq("tenant_id", wrongTenant.id);
      if (error) throw new Error(error.message);
    }
  }

  if (deleteLeads && deletableLeadIds.length > 0) {
    for (let i = 0; i < deletableLeadIds.length; i += 100) {
      const { error } = await supabase.from("leads").delete().in("id", deletableLeadIds.slice(i, i + 100)).eq("tenant_id", wrongTenant.id);
      if (error) throw new Error(error.message);
    }
  }

  console.log("Limpeza concluida.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
