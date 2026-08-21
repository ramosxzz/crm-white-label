import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TenantTheme } from "@/components/app/tenant-theme";
import { getCurrentContext } from "@/lib/tenant";
import { LogoutButton } from "./logout-button";

/**
 * Login restrito de prospeccao (Jeruza): cadastra lead/parceiro e roteia
 * pra pasta de uma vendedora. Fica fora do grupo (app) de proposito - igual
 * o app de campo do tecnico, ela nao precisa (nem deve) ver o resto do CRM.
 */
export const metadata: Metadata = {
  title: "Prospecção",
};

export default async function ProspeccaoLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "prospeccao" && ctx.role !== "owner" && ctx.role !== "admin") redirect("/dashboard");
  if (!ctx.tenant.lead_folders_enabled) redirect("/dashboard");

  return (
    <>
      <TenantTheme brandColor={ctx.tenant.brand_color} />
      <div className="flex min-h-[100dvh] flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ctx.tenant.name}</p>
            <p className="text-[11px] text-muted-foreground">Prospecção</p>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:p-6">{children}</main>
      </div>
    </>
  );
}
