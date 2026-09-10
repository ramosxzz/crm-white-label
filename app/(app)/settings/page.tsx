import Link from "next/link";
import { MessageSquareText, ArrowRight, UserCog, ShieldCheck } from "lucide-react";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { canManageCompanySettings, canManageUsers } from "@/lib/auth/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantForm } from "./tenant-form";
import { ProfileForm } from "./profile-form";
import { Api4comForm } from "./api4com-form";

export default async function SettingsPage() {
  const ctx = await requireContext();
  const canCompany = canManageCompanySettings(ctx.role);
  const canUsers = canManageUsers(ctx.role);
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, job_title, bio, api4com_extension")
    .eq("id", ctx.userId)
    .single();
  const currentProfile = profile as {
    full_name?: string | null;
    avatar_url?: string | null;
    job_title?: string | null;
    bio?: string | null;
    api4com_extension?: string | null;
  } | null;

  return (
    <div className="space-y-6 p-6">
      <nav aria-label="Seções das configurações" className="flex gap-2 overflow-x-auto border-b border-border/70 pb-3 text-sm">
        <a href="#perfil" className="min-w-max rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">Meu perfil</a>
        {canCompany && <a href="#empresa" className="min-w-max rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">Identidade e módulos</a>}
        {ctx.tenant.calls_dashboard_enabled && <a href="#telefonia" className="min-w-max rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">Telefonia</a>}
        {canUsers && <a href="#usuarios" className="min-w-max rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">Usuários e permissões</a>}
        {canUsers && <a href="#seguranca" className="min-w-max rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60">Segurança e auditoria</a>}
      </nav>

      <Card id="perfil" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Meu perfil</CardTitle>
          <CardDescription>
            Altere o nome exibido no CRM para sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            currentName={currentProfile?.full_name ?? ""}
            currentAvatarUrl={currentProfile?.avatar_url}
            currentJobTitle={currentProfile?.job_title}
            currentBio={currentProfile?.bio}
          />
        </CardContent>
      </Card>

      {ctx.tenant.calls_dashboard_enabled && (
        <Card id="telefonia" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Ligações (Api4com)</CardTitle>
            <CardDescription>
              Configure seu ramal para usar o botão de ligar direto dos leads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Api4comForm currentExtension={currentProfile?.api4com_extension ?? ""} />
          </CardContent>
        </Card>
      )}

      {canCompany && (
        <Card id="empresa" className="scroll-mt-24">
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
        <Link id="usuarios" className="block scroll-mt-24" href="/settings/users" prefetch>
          <Card className="group transition-colors hover:border-brand/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Usuários e permissões</p>
                <p className="text-sm text-muted-foreground">
                  Crie atendentes e controle quem aparece nas mensagens do chat.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand" />
            </CardContent>
          </Card>
        </Link>
      )}

      {canUsers && (
        <Link id="seguranca" className="block scroll-mt-24" href="/settings/auditoria" prefetch>
          <Card className="group transition-colors hover:border-brand/40">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Trilha de Auditoria</p>
                <p className="text-sm text-muted-foreground">
                  Acompanhe logs de exportação, exclusão e alterações críticas da empresa.
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
