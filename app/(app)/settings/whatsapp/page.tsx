import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppBaseUrl } from "@/lib/app-url";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { WhatsAppConnectionsManager } from "./whatsapp-connections-manager";

export default async function WhatsAppSettingsPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });

  const webhookBase = await getAppBaseUrl();
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <WhatsAppConnectionsManager accounts={(accounts ?? []) as WhatsAppAccount[]} />
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>URLs para configurar no painel do provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <CodeRow label="Cloud API (Meta)" url={`${webhookBase}/api/webhooks/whatsapp/cloud_api`} />
          <CodeRow label="Verify token (Meta)" url={verifyToken || "WHATSAPP_WEBHOOK_VERIFY_TOKEN nao configurado"} />
          <CodeRow label="Evolution API" url={`${webhookBase}/api/webhooks/whatsapp/evolution`} />
          <CodeRow label="Z-API" url={`${webhookBase}/api/webhooks/whatsapp/zapi`} />
          <p className="border-t border-border/50 pt-3 text-muted-foreground">
            Na Meta, configure o produto WhatsApp com a URL da Cloud API e cole exatamente o verify token acima.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CodeRow({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <div className="mb-1.5 font-medium">{label}</div>
      <code className="block break-all rounded-md bg-muted px-2.5 py-1.5 font-mono text-[11px]">{url}</code>
    </div>
  );
}
