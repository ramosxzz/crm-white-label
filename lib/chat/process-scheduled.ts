import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import type { MediaKind } from "@/lib/whatsapp/provider";

type ScheduledRow = {
  id: string;
  tenant_id: string;
  lead_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
};

/** Envia as mensagens agendadas cujo horário já passou. Usa o service client. */
export async function processScheduledMessages(supabase: SupabaseClient): Promise<number> {
  const { data: due } = await supabase
    .from("scheduled_messages")
    .select("id, tenant_id, lead_id, body, media_url, media_type")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .limit(50);

  let sent = 0;

  for (const row of (due ?? []) as ScheduledRow[]) {
    try {
      const { data: lead } = await supabase
        .from("leads")
        .select("id, phone")
        .eq("id", row.lead_id)
        .maybeSingle();
      const phone = (lead as { phone?: string } | null)?.phone ?? "";
      const to = normalizeWhatsAppPhone(phone) ?? phone.replace(/\D/g, "");
      if (!to) throw new Error("Lead sem telefone");

      const { data: account } = await supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("tenant_id", row.tenant_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!account) throw new Error("Sem conta WhatsApp ativa");

      // Conversa
      let convId: string | undefined;
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("tenant_id", row.tenant_id)
        .eq("lead_id", row.lead_id)
        .eq("channel", "whatsapp")
        .maybeSingle();
      if (conv) {
        convId = (conv as { id: string }).id;
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({
            tenant_id: row.tenant_id,
            lead_id: row.lead_id,
            whatsapp_account_id: (account as { id?: string }).id ?? null,
            channel: "whatsapp",
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        convId = (created as { id: string } | null)?.id;
      }

      const provider = createProvider(account as unknown as WhatsAppAccount);
      const isMedia = Boolean(row.media_url);

      // Registra a mensagem
      const { data: msg } = convId
        ? await supabase
            .from("messages")
            .insert({
              tenant_id: row.tenant_id,
              conversation_id: convId,
              direction: "outbound",
              body: row.body ?? "",
              media_url: row.media_url,
              media_type: row.media_type,
              status: "pending",
            })
            .select("id")
            .single()
        : { data: null };

      let ok = false;
      if (isMedia && provider.sendMedia) {
        const result = await provider.sendMedia({
          to,
          mediaUrl: row.media_url!,
          mediaKind: (row.media_type as MediaKind) ?? "document",
          caption: row.body ?? undefined,
        });
        ok = result.status === "sent";
      } else {
        const result = await provider.send({ to, body: row.body ?? "" });
        ok = result.status === "sent";
      }

      if (msg) {
        await supabase
          .from("messages")
          .update({ status: ok ? "sent" : "failed" })
          .eq("id", (msg as { id: string }).id);
      }
      if (convId && ok) {
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString(), status: "em_atendimento" })
          .eq("id", convId);
      }

      await supabase
        .from("scheduled_messages")
        .update({ status: ok ? "sent" : "failed", sent_at: new Date().toISOString(), error: ok ? null : "Falha no envio" })
        .eq("id", row.id);

      if (ok) sent++;
    } catch (err) {
      await supabase
        .from("scheduled_messages")
        .update({ status: "failed", error: (err as Error).message, sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  return sent;
}
