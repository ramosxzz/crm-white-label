import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";
import { MobileMenuProvider } from "@/components/app/mobile-menu-context";
import { TenantTheme } from "@/components/app/tenant-theme";
import { TenantPageTitle } from "@/components/app/tenant-page-title";
import { getCurrentContext } from "@/lib/tenant";
import { canReviewServiceOrder } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppHealthBannerAsync } from "@/components/app/whatsapp-health-banner-async";
import { getTeamChatUnreadCount } from "@/lib/team-chat/unread";
import { PaymentOverdueBanner } from "@/components/app/payment-overdue-banner";
import { ForceLightTheme } from "@/components/app/force-light-theme";
import { TopNavigationProgress } from "@/components/ui/top-navigation-progress";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getCurrentContext();
  if (!ctx) {
    return { title: "SolAIre W+ CRM" };
  }
  const name = ctx.tenant.name.trim() || "Empresa";
  return {
    title: {
      default: `${name} CRM`,
      template: `%s · ${name}`,
    },
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  // Tecnico nao usa o CRM: o app dele e /campo, com layout proprio. Barrar
  // aqui, na raiz do grupo, e mais confiavel do que esconder item por item
  // do menu - qualquer rota nova ja nasce fechada pra ele.
  if (ctx.role === "tecnico") redirect("/campo");

  // Prospeccao (Jeruza): cadastra lead/parceiro e roteia pra pasta de
  // vendedora, mas tambem atende pelo WhatsApp igual as outras vendedoras -
  // por isso so barra fora de /prospeccao, /chat e /settings/whatsapp (nao
  // some pro shell inteiro do CRM como o tecnico/os-only acima).
  if (ctx.role === "prospeccao") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const allowed =
      pathname.startsWith("/prospeccao") ||
      pathname.startsWith("/chat") ||
      pathname.startsWith("/settings/whatsapp");
    if (!allowed) redirect("/prospeccao");
  }

  // Login restrito a Agenda/OS (ex.: quem so faz conferencia de OS no ACT):
  // bloqueia qualquer rota fora de /os aqui na raiz, pelo mesmo motivo do
  // tecnico acima - novo menu/rota ja nasce fechado pra ela por padrao.
  if (ctx.osOnlyAccess) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    // /financeiro fica de fora do "/os": quem tem essa conta E permissao de
    // gestao financeira (Sidebar so mostra o link nesse caso) precisa
    // conseguir abrir - nao e so-Agenda/OS igual o resto do CRM que essa
    // conta nao ve.
    if (!pathname.startsWith("/os") && pathname !== "/financeiro") redirect("/os/agenda");
  }

  const supabase = await createClient();
  const [{ data: profile }, unreadTeamChat] = await Promise.all([
    supabase.from("profiles").select("full_name, last_seen_update_at").eq("id", ctx.userId).single(),
    getTeamChatUnreadCount(supabase, ctx.tenantId, ctx.userId),
  ]);

  return (
    <>
      <Suspense fallback={null}>
        <TopNavigationProgress />
      </Suspense>
      <TenantTheme brandColor={ctx.userEmail === "demo@solairew.com" ? "#2563EB" : ctx.tenant.brand_color} />
      <TenantPageTitle tenantName={ctx.tenant.name} />
      {ctx.osOnlyAccess && <ForceLightTheme />}
      <MobileMenuProvider>
        <div className="flex h-[100dvh] overflow-hidden print:h-auto print:overflow-visible print:block">
          <div className="print:hidden">
            <Sidebar
              tenantId={ctx.tenantId}
              userId={ctx.userId}
              unreadTeamChat={unreadTeamChat}
              tenantName={ctx.tenant.name}
              tenantLogoUrl={ctx.tenant.logo_url}
              tenantTagline={ctx.tenant.tagline}
              stockEnabled={ctx.tenant.stock_enabled}
              satisfactionSurveyEnabled={ctx.tenant.satisfaction_survey_enabled}
              callsDashboardEnabled={ctx.tenant.calls_dashboard_enabled}
              broadcastEnabled={ctx.tenant.broadcast_enabled}
              fieldServiceEnabled={ctx.tenant.field_service_enabled}
              leadFoldersEnabled={ctx.tenant.lead_folders_enabled}
              canManageFinance={canReviewServiceOrder(ctx.role)}
              canManageFieldService={canReviewServiceOrder(ctx.role)}
              isSeller={ctx.role === "vendedor"}
              isProspeccao={ctx.role === "prospeccao"}
              osOnlyAccess={ctx.osOnlyAccess}
              userName={profile?.full_name ?? "Usuario"}
              userEmail={ctx.userEmail}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col print:block print:min-h-0">
            <div className="print:hidden">
              <Topbar lastSeenUpdateAt={profile?.last_seen_update_at ?? null} />
              {ctx.tenant.payment_overdue && <PaymentOverdueBanner dueAt={ctx.tenant.payment_due_at} />}
              <Suspense fallback={null}>
                <WhatsAppHealthBannerAsync tenantId={ctx.tenantId} userId={ctx.userId} role={ctx.role} />
              </Suspense>
            </div>
            <main className="flex-1 overflow-auto pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0 print:overflow-visible print:pb-0">{children}</main>
          </div>
          <div className="print:hidden">
            <MobileBottomNav
              stockEnabled={ctx.tenant.stock_enabled}
              satisfactionSurveyEnabled={ctx.tenant.satisfaction_survey_enabled}
              callsDashboardEnabled={ctx.tenant.calls_dashboard_enabled}
              broadcastEnabled={ctx.tenant.broadcast_enabled}
              fieldServiceEnabled={ctx.tenant.field_service_enabled}
              canManageFinance={canReviewServiceOrder(ctx.role)}
              isSeller={ctx.role === "vendedor"}
              osOnlyAccess={ctx.osOnlyAccess}
            />
          </div>
        </div>
      </MobileMenuProvider>
    </>
  );
}
