import { createClient } from "@/lib/supabase/server";
import { getTenantWhatsAppAlerts } from "@/lib/whatsapp/health-checker";
import { getChatAccountVisibility, canAccessConversationAccount } from "@/lib/chat/list-conversation-items";
import { WhatsAppHealthBanner } from "@/components/app/whatsapp-health-banner";
import type { MemberRole } from "@/lib/supabase/database.types";

export async function WhatsAppHealthBannerAsync({
  tenantId,
  userId,
  role,
}: {
  tenantId: string;
  userId: string;
  role: MemberRole;
}) {
  const supabase = await createClient();
  const [allAlerts, visibility] = await Promise.all([
    getTenantWhatsAppAlerts(supabase, tenantId),
    getChatAccountVisibility(tenantId, userId, role),
  ]);

  // Gestao ve alerta de qualquer numero (e quem precisa agir). Vendedor e
  // prospeccao so veem o numero deles - antes o banner de UM numero
  // instavel aparecia pra empresa inteira, mesmo pra quem nem usa aquele
  // numero (ex: Jeruza via alerta do numero da Michele).
  const alerts = allAlerts.filter((alert) => canAccessConversationAccount(alert.accountId, visibility));

  if (!alerts || alerts.length === 0) return null;

  return <WhatsAppHealthBanner alerts={alerts} />;
}
