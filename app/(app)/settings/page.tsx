import Link from "next/link";
import { MessageSquareText, ArrowRight, UserCog } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canManageCompanySettings, canManageUsers } from "@/lib/auth/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantForm } from "./tenant-form";
import { ProfileForm } from "./profile-form";
import { Api4comForm } from "./api4com-form";
import { AdSignaturesPanel } from "@/components/settings/ad-signatures-panel";

export default async function SettingsPage() {
  const ctx = await requireContext();
  const canCompany = canManageCompanySettings(ctx.role);
  const canUsers = canManageUsers(ctx.role);
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, api4com_extension")
    .eq("id", ctx.userId)
    .single();
  const currentProfile = profile as { full_name?: string | null; api4com_extension?: string | null } | null;

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Meu perfil</CardTitle>
          <CardDescription>
            Altere o nome exibido no CRM para sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm currentName={currentProfile?.full_name ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ligacoes (Api4com)</CardTitle>
          <CardDescription>
            Configure seu ramal para usar o botao de ligar direto dos leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Api4comForm currentExtension={currentProfile?.api4com_extension ?? ""} />
        </CardContent>
      </Card>

      {canCompany && (
        <Card>
          <CardHeader>
            <CardTitle>Identidade da empresa</CardTitle>
            <CardDescription>
              Logo, cores e nome exibidos no CRM — white label para cada empresa cadastrada.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantForm tenant={ctx.tenant} role={ctx.role} />
          </CardContent>
        </Card>
      )}

      {canCompany && (
        <Card>
          <CardHeader>
            <CardTitle>Criativos por emoji</CardTitle>
            <CardDescription>
              Identifica de qual anuncio veio cada lead pelo emoji da primeira mensagem, para as
              vendas aparecerem por criativo no painel de anuncios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdSignaturesPanel />
          </CardContent>
        </Card>
      )}

      <Link href="/mensagens-rapidas" prefetch>
        <Card className="group transition-colors hover:border-brand/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Mensagens rápidas</p>
              <p className="text-sm text-muted-foreground">
                Frases prontas para o time usar nas conversas do WhatsApp.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand" />
          </CardContent>
        </Card>
      </Link>

      {canUsers && (
        <Link href="/settings/users" prefetch>
          <Card className="group transition-colors hover:border-brand/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Usuarios</p>
                <p className="text-sm text-muted-foreground">
                  Crie atendentes e controle quem aparece nas mensagens do chat.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand" />
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
