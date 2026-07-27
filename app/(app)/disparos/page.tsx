import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { resumeRunningCampaigns } from "@/lib/disparos/dispatcher";
import { listQuickMessages } from "../settings/quick-messages-actions";
import { PageHeader } from "@/components/app/page-header";
import { DisparoScreen } from "./disparo-screen";
import { listBroadcastLeads, listMessageTemplates } from "./actions";

export default async function DisparosPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.broadcast_enabled) redirect("/dashboard");

  // Retoma campanhas que ficaram "running" sem loop ativo (ex: apos deploy).
  void resumeRunningCampaigns(ctx.tenantId);

  const supabase = await createClient();
  const [leads, quickMessages, templates, { data: accounts }] = await Promise.all([
    listBroadcastLeads(),
    listQuickMessages(),
    listMessageTemplates(),
    supabase
      .from("whatsapp_accounts")
      .select("id, display_name, phone_number")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Comunicação"
        title="Disparos"
        description="Escreva a mensagem, selecione os leads e dispare com intervalo entre os envios."
      />
      <div className="p-8">
        <DisparoScreen
          leads={leads}
          quickMessages={quickMessages}
          templates={templates}
          accounts={accounts ?? []}
        />
      </div>
    </div>
  );
}
