import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { getAppBaseUrl } from "@/lib/app-url";
import { ApiKeysManager } from "./api-keys-manager";
import { WebhooksManager } from "./webhooks-manager";

export default async function ApiIntegrationPage() {
  const ctx = await requireContext();
  // api_keys e api_webhooks nao sao expostas por RLS aos clientes. O contexto
  // autenticado define o tenant e todas as consultas continuam filtradas nele.
  const supabase = createServiceClient();
  const [{ data: keys }, { data: webhooks }] = await Promise.all([
    supabase.from("api_keys").select("*").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }),
    supabase.from("api_webhooks").select("*").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }),
  ]);

  const base = await getAppBaseUrl();

  return (
    <div>
      <PageHeader
        eyebrow="Integração"
        title="API"
        description="Conecte o CRM a outros sistemas (ERPs, sites, Zapier, n8n) com uma chave de API por tenant."
        backHref="/integrations"
      />
      <div className="space-y-6 p-8">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint base</CardTitle>
            <CardDescription>
              Envie o header <code className="rounded bg-muted px-1">Authorization: Bearer &lt;sua_chave&gt;</code> em
              todas as requisições.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <code className="block break-all rounded-md border border-border/70 bg-muted/40 px-3 py-2 font-mono text-xs">{`${base}/api/v1`}</code>
            <Link href="/api-docs" target="_blank" className="text-sm font-medium text-brand hover:underline">
              Ver documentação completa →
            </Link>
          </CardContent>
        </Card>

        <ApiKeysManager keys={keys ?? []} canEdit={["owner", "admin"].includes(ctx.role)} />
        <WebhooksManager webhooks={webhooks ?? []} canEdit={["owner", "admin"].includes(ctx.role)} />
      </div>
    </div>
  );
}
