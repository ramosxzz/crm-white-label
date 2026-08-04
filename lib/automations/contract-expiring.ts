import type { SupabaseClient } from "@supabase/supabase-js";
import { fireAutomationTrigger } from "@/lib/automations/trigger";

/**
 * Dias antes do vencimento em que um lembrete e disparado. Ex: [3, 0] manda
 * um aviso 3 dias antes e outro no proprio dia do vencimento.
 */
const REMINDER_DAYS = [3, 0];

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Varre leads com data de renovacao calculada e dispara o trigger
 * "contract_expiring" nos dias configurados em REMINDER_DAYS. Idempotente:
 * grava em custom_fields.renewal_last_reminder_days pra nao repetir o
 * mesmo lembrete se o job rodar mais de uma vez no dia.
 */
export async function scanContractsExpiring(supabase: SupabaseClient): Promise<number> {
  const today = todayISO();
  const horizon = new Date(Date.now() + Math.max(...REMINDER_DAYS) * 86_400_000 + 86_400_000)
    .toISOString()
    .slice(0, 10);

  const { data: leads } = await supabase
    .from("leads")
    .select("id, tenant_id, custom_fields")
    .not("custom_fields->>renewal_date", "is", null)
    .gte("custom_fields->>renewal_date", today)
    .lte("custom_fields->>renewal_date", horizon)
    .limit(500);

  let fired = 0;

  for (const lead of (leads ?? []) as { id: string; tenant_id: string; custom_fields: Record<string, unknown> }[]) {
    const renewalDate = lead.custom_fields?.renewal_date as string | undefined;
    if (!renewalDate) continue;

    const daysUntil = daysBetween(renewalDate, today);
    if (!REMINDER_DAYS.includes(daysUntil)) continue;

    const lastSent = lead.custom_fields?.renewal_last_reminder_days;
    if (lastSent === daysUntil) continue;

    await fireAutomationTrigger(lead.tenant_id, "contract_expiring", lead.id, {
      renewal_date: renewalDate,
      days_until: daysUntil,
    });

    await supabase
      .from("leads")
      .update({
        custom_fields: { ...lead.custom_fields, renewal_last_reminder_days: daysUntil },
      })
      .eq("id", lead.id);

    fired++;
  }

  return fired;
}
