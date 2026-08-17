import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

async function loadModule() {
  await mkdir("node_modules/.cache", { recursive: true });
  const outfile = "node_modules/.cache/audit-logger-test.mjs";
  await build({
    entryPoints: ["lib/audit/audit-logger.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

const { logAuditEvent } = await loadModule();

test("Audit Logger: registra evento de auditoria com metadados", async () => {
  let insertedData = null;
  const fakeSupabase = {
    from: (table) => {
      assert.equal(table, "tenant_audit_logs");
      return {
        insert: async (data) => {
          insertedData = data;
          return { error: null };
        },
      };
    },
  };

  const res = await logAuditEvent(fakeSupabase, {
    tenantId: "tenant-123",
    actorId: "user-456",
    actorEmail: "admin@empresa.com",
    actorName: "Admin",
    action: "lead.export_csv",
    resourceType: "lead",
    metadata: { total_leads: 150, format: "csv" },
    ipAddress: "200.100.50.25",
  });

  assert.equal(res.ok, true);
  assert.ok(insertedData);
  assert.equal(insertedData.tenant_id, "tenant-123");
  assert.equal(insertedData.action, "lead.export_csv");
  assert.equal(insertedData.metadata.total_leads, 150);
});

test("Audit Logger: valida campos obrigatórios", async () => {
  const fakeSupabase = {};
  const res = await logAuditEvent(fakeSupabase, {
    tenantId: "",
    action: "",
    resourceType: "",
  });

  assert.equal(res.ok, false);
});
