import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/auth/roles";

// Integracoes sao config da empresa: vendedor nao acessa nenhuma subpagina.
export default async function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  if (!canManageIntegrations(ctx.role)) redirect("/dashboard");
  return <>{children}</>;
}
