import { Instagram, CheckCircle, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import Link from "next/link";

async function getAccount() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("instagram_accounts")
    .select("id, page_id, instagram_business_account_id, display_name, is_active, created_at")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  return { account: data, ctx };
}

async function saveAccount(formData: FormData) {
  "use server";
  const ctx = await requireContext();
  const supabase = await createClient();

  const pageId = String(formData.get("page_id") || "").trim();
  const pageAccessToken = String(formData.get("page_access_token") || "").trim();
  const instagramBusinessAccountId = String(
    formData.get("instagram_business_account_id") || "",
  ).trim();
  const displayName = String(formData.get("display_name") || "").trim();
  const webhookVerifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "";

  if (!pageId || !pageAccessToken) return;

  await supabase.from("instagram_accounts").upsert(
    {
      tenant_id: ctx.tenantId,
      page_id: pageId,
      page_access_token: pageAccessToken,
      instagram_business_account_id: instagramBusinessAccountId || null,
      display_name: displayName || null,
      webhook_verify_token: webhookVerifyToken || null,
      is_active: true,
    },
    { onConflict: "tenant_id,page_id" },
  );

  revalidatePath("/integrations/instagram");
}

async function disconnectAccount() {
  "use server";
  const ctx = await requireContext();
  const supabase = await createClient();
  await supabase.from("instagram_accounts").delete().eq("tenant_id", ctx.tenantId);
  revalidatePath("/integrations/instagram");
}

const INSTAGRAM_APP_ID = process.env.META_INSTAGRAM_APP_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

function buildOAuthUrl() {
  if (!INSTAGRAM_APP_ID || !APP_URL) return null;
  const redirectUri = encodeURIComponent(`${APP_URL}/api/auth/instagram/callback`);
  const scope = "instagram_business_basic,instagram_business_manage_messages";
  return `https://www.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
}

export default async function InstagramIntegrationPage(props: { searchParams?: Promise<{ success?: string; error?: string }> }) {
  const searchParams = await props.searchParams;
  const { account } = await getAccount();
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/instagram`;
  const webhookVerifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "";
  const oauthUrl = buildOAuthUrl();

  return (
    <div>
      <PageHeader
        eyebrow="Integracao"
        title="Instagram DM"
        backHref="/integrations"
        description="Capture leads vindos do Instagram automaticamente via DM."
      />

      <div className="grid gap-6 p-8 lg:grid-cols-2">
        {/* Success / error banners */}
        {searchParams?.success && (
          <div className="lg:col-span-2 flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Instagram conectado com sucesso! Leads via DM ja chegam automaticamente.
          </div>
        )}
        {searchParams?.error && (
          <div className="lg:col-span-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {searchParams.error === "no_pages"
              ? "Nenhuma pagina do Facebook encontrada. Certifique-se de autorizar a pagina vinculada ao Instagram Business."
              : `Erro ao conectar: ${searchParams.error}. Tente novamente ou use o formulario manual.`}
          </div>
        )}

        {/* OAuth connect card */}
        {!account && oauthUrl && (
          <Card className="lg:col-span-2 border-brand/30 bg-brand/5">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
                <Instagram className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">Conectar via Instagram Business Login</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clique no botao abaixo, autorize o app no Facebook e o token sera salvo automaticamente.
                  Funciona para qualquer empresa — o fluxo correto para SaaS.
                </p>
              </div>
              <Link href={oauthUrl}>
                <Button variant="brand" size="lg" className="shrink-0">
                  <Instagram className="h-4 w-4" />
                  Conectar Instagram
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Status card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-500" />
                Status da conexao
              </CardTitle>
              {account?.is_active ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Nao configurado
                </Badge>
              )}
            </div>
            <CardDescription>
              {account
                ? `Pagina conectada: ${account.display_name || account.page_id}`
                : "Conecte sua pagina do Facebook vinculada ao Instagram Business."}
            </CardDescription>
          </CardHeader>

          {account && (
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium">Page ID:</span> {account.page_id}
                </p>
                {account.instagram_business_account_id && (
                  <p>
                    <span className="font-medium">Instagram ID:</span>{" "}
                    {account.instagram_business_account_id}
                  </p>
                )}
                <p>
                  <span className="font-medium">Conectado em:</span>{" "}
                  {new Date(account.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <form action={disconnectAccount}>
                <Button variant="destructive" size="sm" type="submit">
                  Desconectar
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Webhook URL card */}
        <Card>
          <CardHeader>
            <CardTitle>URL do Webhook</CardTitle>
            <CardDescription>
              Cole essa URL nas configuracoes do seu App Meta (produto Messenger / Instagram).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Copiar"
                onClick={undefined}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Campo de verificacao no Meta: cole exatamente o token abaixo.
            </p>
            <code className="block rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all">
              {webhookVerifyToken || "INSTAGRAM_WEBHOOK_VERIFY_TOKEN nao configurado"}
            </code>
          </CardContent>
        </Card>

        {/* Setup form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{account ? "Atualizar configuracao" : "Conectar Instagram"}</CardTitle>
            <CardDescription>
              Insira as credenciais do seu App Meta. Voce precisa de uma pagina do Facebook
              vinculada a uma conta Instagram Business.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveAccount} className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="page_id">Page ID da pagina do Facebook *</Label>
                <Input
                  id="page_id"
                  name="page_id"
                  placeholder="123456789012345"
                  defaultValue={account?.page_id ?? ""}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Encontrado em: Meta Business Suite → Configuracoes → Pagina → ID
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instagram_business_account_id">Instagram Business Account ID</Label>
                <Input
                  id="instagram_business_account_id"
                  name="instagram_business_account_id"
                  placeholder="987654321098765"
                  defaultValue={account?.instagram_business_account_id ?? ""}
                />
                <p className="text-xs text-muted-foreground">
                  Opcional mas recomendado para envio de mensagens.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="page_access_token">Page Access Token (longa duracao) *</Label>
                <Input
                  id="page_access_token"
                  name="page_access_token"
                  type="password"
                  placeholder="EAAxxxxxxxx..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Gere um token de longa duracao no Graph API Explorer e adicione permissoes
                  instagram_manage_messages e pages_messaging.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="display_name">Nome de exibicao (opcional)</Label>
                <Input
                  id="display_name"
                  name="display_name"
                  placeholder="Instagram da sua empresa"
                  defaultValue={account?.display_name ?? ""}
                />
              </div>

              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  {account ? "Salvar alteracoes" : "Conectar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Step-by-step guide */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Como configurar no Meta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="list-inside list-decimal space-y-3 text-muted-foreground">
              <li>
                Acesse{" "}
                <a
                  href="https://developers.facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand underline"
                >
                  developers.facebook.com
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                e crie (ou acesse) seu App.
              </li>
              <li>
                Adicione o produto <strong>Messenger</strong> e em seguida habilite o{" "}
                <strong>Instagram</strong>.
              </li>
              <li>Va em <strong>Webhook</strong> → <strong>Instagram</strong> e adicione o endpoint acima com o verify token exibido nesta tela.</li>
              <li>
                Assine os campos: <code className="rounded bg-muted px-1">messages</code> e{" "}
                <code className="rounded bg-muted px-1">messaging_postbacks</code>.
              </li>
              <li>
                Gere um <strong>Page Access Token de longa duracao</strong> via Graph API Explorer
                com as permissoes{" "}
                <code className="rounded bg-muted px-1">instagram_manage_messages</code> e{" "}
                <code className="rounded bg-muted px-1">pages_messaging</code>.
              </li>
              <li>Cole as credenciais no formulario acima e salve.</li>
            </ol>
            <p className="rounded-md border border-brand/30 bg-brand/5 p-3 text-xs text-foreground">
              <strong>Resultado:</strong> toda DM recebida no Instagram cria um lead automaticamente
              no CRM, na primeira etapa do funil padrao.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
