import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { WhatsAppConnectionsManager } from "@/app/(app)/settings/whatsapp/whatsapp-connections-manager";
import { getAppBaseUrl } from "@/lib/app-url";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import { WhatsAppEmbeddedSignupButton } from "./embedded-signup-button";

export default async function WhatsAppIntegrationPage() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });

  const webhookBase = await getAppBaseUrl();
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const hasCloudApi = (accounts ?? []).some((a) => a.provider === "cloud_api");

  return (
    <div>
      <PageHeader
        eyebrow="Integracao"
        title="WhatsApp"
        description="Conecte seu numero comercial e atenda todos os leads de dentro do CRM."
        backHref="/integrations"
      />
      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        {!hasCloudApi && (
          <Card className="xl:col-span-2 border-brand/30 bg-brand/5">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">Conectar via WhatsApp Cloud API oficial</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clique no botao, cadastre seu numero pelo fluxo da Meta e o CRM salva as credenciais
                  automaticamente. Sem precisar colar token manualmente.
                </p>
              </div>
              <WhatsAppEmbeddedSignupButton />
            </CardContent>
          </Card>
        )}
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
              <strong className="text-foreground">Z-API:</strong> cole a URL em Webhooks no painel da instância. Envio exige
              instância conectada + Client Token (Segurança da conta). Ao salvar/testar, o CRM ativa automaticamente as
              mensagens enviadas pelo WhatsApp do celular.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Cloud API:</strong> no App Meta, configure a URL da Cloud API e cole
              exatamente o verify token acima.
            </p>
          </CardContent>
        </Card>
      </div>
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
