import { Mail, CheckCircle, AlertCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/auth/roles";
import { formatBRTFullDate } from "@/lib/date/brt";

const ERROR_LABELS: Record<string, string> = {
  sem_permissao: "Voce nao tem permissao para conectar integracoes.",
  state_mismatch: "Sessao expirou no meio do processo. Tente novamente.",
  no_refresh_token:
    "O Google nao devolveu permissao renovavel. Revogue o acesso em myaccount.google.com/permissions e tente conectar de novo.",
  oauth_failed: "Falha ao conectar com o Google. Tente novamente.",
};

async function disconnectAccount() {
  "use server";
  const ctx = await requireContext();
  if (!canManageIntegrations(ctx.role)) throw new Error("Sem permissao para gerenciar integracoes");
  const supabase = await createClient();
  await supabase.from("google_accounts").delete().eq("tenant_id", ctx.tenantId);
  revalidatePath("/integrations/gmail");
}

export default async function GmailIntegrationPage(props: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const ctx = await requireContext();
  if (!canManageIntegrations(ctx.role)) redirect("/dashboard");

  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("google_accounts")
    .select("google_email, created_at")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  return (
    <div>
      <PageHeader
        eyebrow="Integracao"
        title="Gmail"
        backHref="/integrations"
        description="Veja os emails trocados com cada lead direto na ficha dele no CRM."
      />

      <div className="grid gap-6 p-8 lg:grid-cols-2">
        {searchParams?.success && (
          <div className="lg:col-span-2 flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Gmail conectado com sucesso!
          </div>
        )}
        {searchParams?.error && (
          <div className="lg:col-span-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {ERROR_LABELS[searchParams.error] ?? `Erro ao conectar: ${searchParams.error}`}
          </div>
        )}

        {!account && (
          <Card className="lg:col-span-2 border-brand/30 bg-brand/5">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-400 text-white">
                <Mail className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">Conectar conta do Gmail</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Autorize o acesso de leitura ao Gmail. Nos abrimos os emails trocados com o
                  endereco de cada lead direto na ficha dele — nada e enviado sem voce pedir.
                </p>
              </div>
              <a href="/api/auth/google">
                <Button variant="brand" size="lg" className="shrink-0">
                  <Mail className="h-4 w-4" />
                  Conectar Gmail
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-red-500" />
                Status da conexao
              </CardTitle>
              {account ? (
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
              {account ? `Conta conectada: ${account.google_email}` : "Nenhuma conta do Gmail conectada ainda."}
            </CardDescription>
          </CardHeader>

          {account && (
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                <p>
                  <span className="font-medium">Conectado em:</span> {formatBRTFullDate(account.created_at)}
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

        <Card>
          <CardHeader>
            <CardTitle>Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              So leitura (<code className="rounded bg-muted px-1">gmail.readonly</code>) — o CRM nunca envia,
              apaga ou modifica nada na sua caixa de entrada.
            </p>
            <p>
              Na ficha do lead, mostramos os ultimos emails trocados com o endereco cadastrado
              dele, buscando ao vivo direto na sua conta conectada.
            </p>
            <p>So owner/admin podem conectar ou desconectar essa integracao.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
