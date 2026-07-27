import { redirect } from "next/navigation";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { resumeRunningCampaigns } from "@/lib/disparos/dispatcher";
import { listQuickMessages } from "../settings/quick-messages-actions";
import { PageHeader } from "@/components/app/page-header";
import { NewCampaignDialog } from "./new-campaign-dialog";
import { CampaignsList, type CampaignSummary } from "./campaigns-list";

export default async function DisparosPage() {
  const ctx = await requireContext();
  if (!ctx.tenant.broadcast_enabled) redirect("/dashboard");

  // Retoma campanhas que ficaram "running" sem loop ativo (ex: apos deploy).
  void resumeRunningCampaigns(ctx.tenantId);

  const supabase = await createClient();
  const [{ data: campaigns }, quickMessages] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, delay_seconds, created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false }),
    listQuickMessages(),
  ]);

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: recipientRows } =
    campaignIds.length > 0
      ? await supabase.from("campaign_recipients").select("campaign_id, status").in("campaign_id", campaignIds)
      : { data: [] as { campaign_id: string; status: string }[] };

  const counts = new Map<string, { total: number; sent: number; failed: number }>();
  for (const row of recipientRows ?? []) {
    const entry = counts.get(row.campaign_id) ?? { total: 0, sent: 0, failed: 0 };
    entry.total += 1;
    if (row.status === "sent") entry.sent += 1;
    if (row.status === "failed") entry.failed += 1;
    counts.set(row.campaign_id, entry);
  }

  const summaries: CampaignSummary[] = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    delay_seconds: c.delay_seconds,
    created_at: c.created_at,
    ...(counts.get(c.id) ?? { total: 0, sent: 0, failed: 0 }),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Comunicação"
        title="Disparos"
        description="Envie uma mensagem para vários leads de uma vez, com um intervalo entre os envios."
        actions={<NewCampaignDialog quickMessages={quickMessages} />}
      />
      <div className="p-8">
        <CampaignsList campaigns={summaries} />
      </div>
    </div>
  );
}
