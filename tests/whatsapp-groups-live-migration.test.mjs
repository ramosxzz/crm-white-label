import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260812150000_whatsapp_groups_live_chat.sql";

test("group migration keeps unread updates atomic and deduplicated", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /unread_count = case[\s\S]*unread_count \+ 1/i);
  assert.match(sql, /unique index[\s\S]*payload ->> 'external_id'/i);
  assert.match(sql, /after insert on public\.whatsapp_webhook_logs/i);
});

test("group migration publishes only group summaries to realtime and scopes RLS", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter publication supabase_realtime add table public\.whatsapp_groups/i);
  assert.match(sql, /wa\.assigned_to = auth\.uid\(\)/i);
  assert.match(sql, /wa\.shared_with_all is true/i);
  assert.doesNotMatch(sql, /alter publication supabase_realtime add table public\.whatsapp_webhook_logs/i);
});
