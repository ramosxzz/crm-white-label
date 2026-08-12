import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, WhatsAppAccount } from "@/lib/supabase/database.types";
import { toJson } from "@/lib/utils";
import { parseEvolutionGroupEvents } from "@/lib/whatsapp/evolution-groups";
import { parseEvolutionGroupMessages } from "@/lib/whatsapp/evolution-group-messages";
import { persistWhatsAppMedia } from "@/lib/whatsapp/media-storage";

type ServiceClient = SupabaseClient<Database>;

export type EvolutionGroupSyncResult = {
  handled: boolean;
  groups: number;
  messages: number;
};

export async function persistEvolutionGroups(
  supabase: ServiceClient,
  account: WhatsAppAccount,
  payload: unknown,
): Promise<EvolutionGroupSyncResult> {
  const groupEvents = parseEvolutionGroupEvents(payload);
  const groupMessages = parseEvolutionGroupMessages(payload);

  if (groupEvents.length === 0 && groupMessages.length === 0) {
    return { handled: false, groups: 0, messages: 0 };
  }

  let persistedGroups = 0;
  for (const event of groupEvents) {
    const { data: current } = await supabase
      .from("whatsapp_groups")
      .select("subject")
      .eq("tenant_id", account.tenant_id)
      .eq("provider_group_id", event.provider_group_id)
      .maybeSingle();

    const subject =
      event.subject === event.provider_group_id && current?.subject
        ? current.subject
        : event.subject;
    const { error } = await supabase.from("whatsapp_groups").upsert(
      {
        tenant_id: account.tenant_id,
        whatsapp_account_id: account.id,
        provider_group_id: event.provider_group_id,
        subject,
        description: event.description,
        owner_jid: event.owner_jid,
        participant_count: event.participant_count,
        last_event_type: event.last_event_type,
        last_event_at: event.last_event_at,
        raw_payload: toJson(event.raw_payload),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider_group_id" },
    );
    if (error) throw new Error(`Falha ao sincronizar grupo: ${error.message}`);
    persistedGroups += 1;
  }

  let persistedMessages = 0;
  for (const message of groupMessages) {
    let { data: group, error: groupError } = await supabase
      .from("whatsapp_groups")
      .select("id, subject")
      .eq("tenant_id", account.tenant_id)
      .eq("provider_group_id", message.provider_group_id)
      .maybeSingle();
    if (groupError) throw new Error(`Falha ao localizar grupo: ${groupError.message}`);

    if (!group) {
      const created = await supabase
        .from("whatsapp_groups")
        .upsert(
          {
            tenant_id: account.tenant_id,
            whatsapp_account_id: account.id,
            provider_group_id: message.provider_group_id,
            subject: message.provider_group_id,
            last_event_type: "GROUP_MESSAGE",
            last_event_at: message.message_at,
            raw_payload: toJson(message.raw_payload),
          },
          { onConflict: "tenant_id,provider_group_id" },
        )
        .select("id, subject")
        .single();
      if (created.error) throw new Error(`Falha ao criar grupo: ${created.error.message}`);
      group = created.data;
    } else {
      const { error } = await supabase
        .from("whatsapp_groups")
        .update({ whatsapp_account_id: account.id })
        .eq("id", group.id)
        .eq("tenant_id", account.tenant_id);
      if (error) throw new Error(`Falha ao vincular grupo ao numero: ${error.message}`);
    }

    const media = await persistWhatsAppMedia(supabase, account, {
      tenantId: account.tenant_id,
      conversationId: `groups/${group.id}`,
      externalId: message.external_id,
      mediaUrl: message.media_url,
      mediaType: message.media_type,
      mediaBase64: message.media_base64,
      mediaMimeType: message.media_mime_type,
      mediaFileName: message.media_file_name,
    });

    const { error } = await supabase.from("whatsapp_webhook_logs").insert({
      tenant_id: account.tenant_id,
      whatsapp_account_id: account.id,
      event_type: "GROUP_MESSAGE",
      from_me: message.direction === "outbound",
      contact_phone: null,
      contact_lid: message.provider_group_id,
      parsed_count: 1,
      payload: toJson({
        external_id: message.external_id,
        provider_group_id: message.provider_group_id,
        sender_jid: message.sender_jid,
        sender_name: message.sender_name,
        direction: message.direction,
        body: message.body,
        media_url: media.mediaUrl,
        media_type: media.mediaType,
        message_at: message.message_at,
        raw_payload: message.raw_payload,
      }),
    });

    // Reentregas do provider sao esperadas. O indice unico da migration
    // garante que contador e thread nao dupliquem a mesma mensagem.
    if (error && error.code !== "23505") {
      throw new Error(`Falha ao gravar mensagem do grupo: ${error.message}`);
    }
    if (!error) persistedMessages += 1;
  }

  return {
    handled: true,
    groups: persistedGroups,
    messages: persistedMessages,
  };
}
