import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { canManageAutomations } from "@/lib/auth/roles";

// Cobre /automations/[id]/editor e /automations/[id]/logs de uma vez.
// A lista em /automations ja barra quem nao gerencia automacao, e as actions
// de salvar/publicar/excluir tambem checam - mas so ler a pagina (com o id na
// URL) nao passava por nenhum dos dois. O editor expõe a configuracao inteira
// do fluxo: blocos de JavaScript, chamadas de API e mensagens configuradas.
export default async function AutomationDetailLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  if (!canManageAutomations(ctx.role)) redirect("/dashboard");
  return <>{children}</>;
}
