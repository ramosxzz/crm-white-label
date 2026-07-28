import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TenantTheme } from "@/components/app/tenant-theme";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { getCurrentContext } from "@/lib/tenant";
import { SyncIndicator } from "./sync-indicator";

/**
 * O app do tecnico fica FORA do grupo (app) de proposito: la o layout monta
 * sidebar, topbar e barra inferior, que nao fazem sentido pra quem esta na
 * casa do cliente com o celular na mao. Aqui a tela e so a OS.
 */
export const metadata: Metadata = {
  title: "Campo",
};

export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (!ctx.tenant.field_service_enabled) redirect("/dashboard");

  return (
    <>
      <TenantTheme brandColor={ctx.tenant.brand_color} />
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ctx.tenant.name}</p>
            <p className="text-[11px] text-muted-foreground">Serviço em campo</p>
          </div>
          <SyncIndicator />
        </header>
        <main className="flex-1 pb-[max(env(safe-area-inset-bottom),1rem)]">{children}</main>
      </div>
      <PwaInstallPrompt />
    </>
  );
}
