import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";
import { TenantTheme } from "@/components/app/tenant-theme";
import { TenantPageTitle } from "@/components/app/tenant-page-title";
import { getCurrentContext } from "@/lib/tenant";
import { canReviewServiceOrder } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, last_seen_update_at")
    .eq("id", ctx.userId)
    .single();

  return (
    <>
      <TenantTheme brandColor={ctx.tenant.brand_color} />
      <TenantPageTitle tenantName={ctx.tenant.name} />
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar
          tenantName={ctx.tenant.name}
          tenantLogoUrl={ctx.tenant.logo_url}
          tenantTagline={ctx.tenant.tagline}
          stockEnabled={ctx.tenant.stock_enabled}
          satisfactionSurveyEnabled={ctx.tenant.satisfaction_survey_enabled}
          callsDashboardEnabled={ctx.tenant.calls_dashboard_enabled}
          broadcastEnabled={ctx.tenant.broadcast_enabled}
          fieldServiceEnabled={ctx.tenant.field_service_enabled}
          canManageFinance={canReviewServiceOrder(ctx.role)}
          isSeller={ctx.role === "vendedor"}
          userName={profile?.full_name ?? "Usuario"}
          userEmail={ctx.userEmail}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar lastSeenUpdateAt={profile?.last_seen_update_at ?? null} />
          <main className="flex-1 overflow-auto pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
        </div>
        <MobileBottomNav
          stockEnabled={ctx.tenant.stock_enabled}
          satisfactionSurveyEnabled={ctx.tenant.satisfaction_survey_enabled}
          callsDashboardEnabled={ctx.tenant.calls_dashboard_enabled}
          broadcastEnabled={ctx.tenant.broadcast_enabled}
          fieldServiceEnabled={ctx.tenant.field_service_enabled}
          canManageFinance={canReviewServiceOrder(ctx.role)}
          isSeller={ctx.role === "vendedor"}
        />
      </div>
    </>
  );
}
