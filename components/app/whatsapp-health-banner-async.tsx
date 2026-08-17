import { createClient } from "@/lib/supabase/server";
import { getTenantWhatsAppAlerts } from "@/lib/whatsapp/health-checker";
import { WhatsAppHealthBanner } from "@/components/app/whatsapp-health-banner";

export async function WhatsAppHealthBannerAsync({ tenantId }: { tenantId: string }) {
  const supabase = await createClient();
  const alerts = await getTenantWhatsAppAlerts(supabase, tenantId);

  if (!alerts || alerts.length === 0) return null;

  return <WhatsAppHealthBanner alerts={alerts} />;
}
