import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { getWhatsAppAccountForLead } from "@/lib/whatsapp/account-for-lead";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";

// Janelas de lembrete (em minutos antes da reunião)
const WINDOWS = [
  { key: "2h", max: 120, min: 30, label: "2 horas" },
  { key: "30m", max: 30, min: 0, label: "30 minutos" },
];

type ApptRow = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  starts_at: string;
  status: string;
  kind: string | null;
  reminders_sent: unknown;
  leads: { name: string | null; phone: string | null } | null;
};

function timeBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Envia confirmações de reunião nas janelas de 12h, 2h e 30min antes. */
export async function processAppointmentReminders(supabase: SupabaseClient): Promise<number> {
  const now = Date.now();
  // Janela maxima de lembrete e 2h; buscamos um pouco alem para nao perder bordas.
  const horizon = new Date(now + 150 * 60 * 1000).toISOString();

  const { data: appts } = await supabase
    .from("appointments")
    .select("id, tenant_id, lead_id, starts_at, status, kind, reminders_sent, leads(name, phone)")
    .in("status", ["scheduled", "confirmed"])
    .gt("starts_at", new Date(now).toISOString())
    .lt("starts_at", horizon)
    .limit(200);

  let sent = 0;

  for (const appt of (appts ?? []) as unknown as ApptRow[]) {
    if (!appt.lead_id) continue;
    const remainingMin = (new Date(appt.starts_at).getTime() - now) / 60000;
    if (remainingMin <= 0) continue;

    const already = Array.isArray(appt.reminders_sent) ? (appt.reminders_sent as string[]) : [];
    const win = WINDOWS.find((w) => remainingMin <= w.max && remainingMin > w.min && !already.includes(w.key));
    if (!win) continue;

    // Reivindica a janela ANTES de enviar (nao depois): se o cron sobrepoe
    // (execucao anterior ainda rodando quando a proxima dispara), duas
    // invocacoes liam reminders_sent vazio ao mesmo tempo e mandavam a
    // mesma confirmacao 2x. O filtro "not contains" so deixa 1 delas
    // ganhar a corrida - a outra recebe 0 linhas e pula o envio.
    const { data: claimed } = await supabase
      .from("appointments")
      .update({ reminders_sent: [...already, win.key] })
      .eq("id", appt.id)
      .not("reminders_sent", "cs", `{${win.key}}`)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const phone = appt.leads?.phone ?? "";
    const to = normalizeWhatsAppPhone(phone) ?? phone.replace(/\D/g, "");
    if (!to) continue;

    const firstName = (appt.leads?.name ?? "").split(" ")[0] || "tudo bem";
    const isCall = appt.kind === "call";
    const body = isCall
      ? `Olá ${firstName}! 👋 Passando para lembrar da nossa ligação agendada para ${timeBR(appt.starts_at)}.\n\n` +
        `Podemos confirmar? ✅`
      : `Olá ${firstName}! 👋 Passando para lembrar da sua reunião marcada para ${timeBR(appt.starts_at)}.\n\n` +
        `Podemos confirmar sua presença? ✅`;

    try {
      // Envia do numero em que o lead conversa, nao da primeira conta ativa.
      const account = await getWhatsAppAccountForLead(supabase, appt.tenant_id, appt.lead_id);
      if (!account) continue;

      // Conversa
      let convId: string | undefined;
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("tenant_id", appt.tenant_id)
        .eq("lead_id", appt.lead_id)
        .eq("channel", "whatsapp")
        .maybeSingle();
      if (conv) {
        convId = (conv as { id: string }).id;
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({
            tenant_id: appt.tenant_id,
            lead_id: appt.lead_id,
            whatsapp_account_id: (account as { id?: string }).id ?? null,
            channel: "whatsapp",
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        convId = (created as { id: string } | null)?.id;
      }

      const { data: msg } = convId
        ? await supabase
            .from("messages")
            .insert({
              tenant_id: appt.tenant_id,
              conversation_id: convId,
              direction: "outbound",
              body,
              status: "pending",
            })
            .select("id")
            .single()
        : { data: null };

      const provider = createProvider(account as unknown as WhatsAppAccount);
      const result = await provider.send({ to, body });
      const ok = result.status === "sent";

      if (msg) {
        await supabase
          .from("messages")
          .update({ status: ok ? "sent" : "failed", external_id: result.externalId })
          .eq("id", (msg as { id: string }).id);
      }
      if (convId && ok) {
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString(), status: "em_atendimento" })
          .eq("id", convId);
      }

      if (ok) sent++;
    } catch {
      /* ignora e tenta na próxima rodada */
    }
  }

  return sent;
}
