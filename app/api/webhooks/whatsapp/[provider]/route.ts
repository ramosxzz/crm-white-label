import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

import { createProvider } from "@/lib/whatsapp/factory";

import { ensureZapiPhoneMessageSync } from "@/lib/whatsapp/ensure-zapi-phone-sync";

import { ZAPI_PHONE_PLACEHOLDER } from "@/lib/whatsapp/zapi";

import { unwrapZapiPayloadForLog } from "@/lib/whatsapp/zapi-log";

import { findOrCreateWhatsAppLead } from "@/lib/leads/find-or-create";

import { applyMessageStatusUpdates } from "@/lib/whatsapp/apply-message-status";
import { isSelfWhatsAppContact } from "@/lib/whatsapp/self-contact";
import { persistWhatsAppMedia } from "@/lib/whatsapp/media-storage";
import { syncLeadWhatsAppProfilePicture } from "@/lib/whatsapp/profile-picture";
import {
  parseZapiMessageStatusUpdates,
  shouldUpgradeMessageStatus,
  type DbMessageStatus,
} from "@/lib/whatsapp/zapi-status";
import { parseEvolutionMessageStatusUpdates } from "@/lib/whatsapp/evolution-status";

import { isValidBrazilWhatsAppPhone, normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

import type { WhatsAppAccount, WhatsAppProviderKind } from "@/lib/supabase/database.types";



export const dynamic = "force-dynamic";



export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {

  const { provider } = await params;

  if (provider !== "cloud_api") return new NextResponse("Not Found", { status: 404 });



  const url = new URL(req.url);

  const mode = url.searchParams.get("hub.mode");

  const token = url.searchParams.get("hub.verify_token");

  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {

    return new NextResponse(challenge, { status: 200 });

  }

  return new NextResponse("Forbidden", { status: 403 });

}



export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {

  const { provider } = await params;

  const validKinds: WhatsAppProviderKind[] = ["cloud_api", "evolution", "zapi"];

  if (!validKinds.includes(provider as WhatsAppProviderKind)) {

    return new NextResponse("Provider invalido", { status: 400 });

  }



  const payload = (await req.json()) as unknown;



  const supabase = createServiceClient();



  const { data: accounts } = await supabase

    .from("whatsapp_accounts")

    .select("*")

    .eq("provider", provider as WhatsAppProviderKind)

    .eq("is_active", true);



  if (!accounts || accounts.length === 0) {

    return new NextResponse("Nenhuma conta configurada", { status: 200 });

  }



  let account: WhatsAppAccount = accounts[0];

  if (provider === "cloud_api") {

    const entry = (payload as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { display_phone_number?: string; phone_number_id?: string } } }> }> }).entry?.[0];

    const metadata = entry?.changes?.[0]?.value?.metadata;
    const phoneNumberId = metadata?.phone_number_id;
    const phone = metadata?.display_phone_number?.replace(/\D/g, "");

    const matchedByPhoneNumberId = phoneNumberId
      ? accounts.find((a) => {
          const creds = a.credentials as { phone_number_id?: string };
          return creds.phone_number_id === phoneNumberId;
        })
      : null;
    const matchedByPhone = accounts.find((a) => a.phone_number.replace(/\D/g, "") === phone);
    const matched = matchedByPhoneNumberId ?? matchedByPhone;

    if (matched) account = matched;

  }

  if (provider === "zapi") {

    const raw = payload as { instanceId?: string; data?: { instanceId?: string } };

    const instanceId = raw.instanceId ?? raw.data?.instanceId;

    if (instanceId) {

      const matched = accounts.find((a) => {

        const creds = a.credentials as { instance_id?: string };

        return creds.instance_id === instanceId;

      });

      if (matched) account = matched;

    }

  }

  if (provider === "evolution") {

    const raw = payload as { instance?: string; instanceId?: string };

    const instanceName = raw.instance;

    if (instanceName) {

      const matched = accounts.find((a) => {

        const creds = a.credentials as { instance?: string };

        return creds.instance === instanceName;

      });

      if (matched) account = matched;

    }

  }

  if (provider === "cloud_api") {
    const raw = payload as {
      entry?: Array<{
        changes?: Array<{
          field?: string;
          value?: {
            metadata?: { display_phone_number?: string; phone_number_id?: string };
            messages?: unknown[];
            statuses?: unknown[];
          };
        }>;
      }>;
    };
    const change = raw.entry?.[0]?.changes?.[0];
    const value = change?.value;
    void supabase.from("whatsapp_webhook_logs").insert({
      tenant_id: account.tenant_id,
      whatsapp_account_id: account.id,
      event_type: change?.field ?? "messages",
      from_me: null,
      contact_phone: value?.metadata?.display_phone_number?.replace(/\D/g, "") ?? null,
      contact_lid: value?.metadata?.phone_number_id ?? null,
      parsed_count: (value?.messages?.length ?? 0) + (value?.statuses?.length ?? 0),
      payload: payload as Record<string, unknown>,
    });
  }



  if (provider === "zapi") {
    await ensureZapiPhoneMessageSync(supabase, account);
  }

  if (provider === "zapi") {
    const statusUpdates = parseZapiMessageStatusUpdates(payload);
    if (statusUpdates.length > 0) {
      const applied = await applyMessageStatusUpdates(
        supabase,
        account.tenant_id,
        statusUpdates,
      );
      return NextResponse.json({ ok: true, parsed: 0, statusUpdates: applied });
    }
  }

  if (provider === "evolution") {
    const evoPayload = payload as { event?: string };
    void supabase.from("whatsapp_webhook_logs").insert({
      tenant_id: account.tenant_id,
      whatsapp_account_id: account.id,
      event_type: evoPayload.event ?? "UNKNOWN",
      from_me: null,
      contact_phone: null,
      contact_lid: null,
      parsed_count: 0,
      payload: payload as Record<string, unknown>,
    });

    const statusUpdates = parseEvolutionMessageStatusUpdates(payload);
    if (statusUpdates.length > 0) {
      const applied = await applyMessageStatusUpdates(supabase, account.tenant_id, statusUpdates);
      return NextResponse.json({ ok: true, parsed: 0, statusUpdates: applied });
    }
  }

  const adapter = createProvider(account);
  const messages = adapter.parseWebhook(payload);

  const accountCredentials = account.credentials as Record<string, unknown>;
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", account.tenant_id)
    .maybeSingle();
  const ignoredContactNames = [
    tenant?.name,
    account.display_name,
    account.phone_number,
    String(accountCredentials.instance ?? ""),
    String(accountCredentials.instance_id ?? ""),
    String(accountCredentials.phone_number ?? ""),
    String(accountCredentials.owner_whatsapp_lid ?? ""),
  ];

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("id, pipeline_stages(id, position)")
    .eq("tenant_id", account.tenant_id)
    .eq("is_default", true)
    .single();
  const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)
    ?.pipeline_stages?.sort((a, b) => a.position - b.position);
  const stageId = stages?.[0]?.id;
  const pipelineId = (pipeline as { id?: string } | null)?.id;

  if (provider === "zapi") {
    const logPayload = unwrapZapiPayloadForLog(payload);
    void supabase.from("whatsapp_webhook_logs").insert({
      tenant_id: account.tenant_id,
      whatsapp_account_id: account.id,
      event_type: logPayload?.type ?? null,
      from_me: logPayload?.fromMe ?? null,
      contact_phone: logPayload?.phone ?? null,
      contact_lid: logPayload?.chatLid ?? logPayload?.senderLid ?? null,
      parsed_count: messages.length,
      payload: payload as Record<string, unknown>,
    });
  }



  for (const msg of messages) {

    const contactPhone = msg.contactPhone ?? (msg.fromPhone.includes("@lid") ? null : normalizeWhatsAppPhone(msg.fromPhone));

    const contactLid = msg.contactLid ?? null;



    if (!contactPhone && !contactLid) continue;

    if (contactPhone && !isValidBrazilWhatsAppPhone(contactPhone)) continue;

    if (isSelfWhatsAppContact(account, { phone: contactPhone, lid: contactLid })) continue;

    if (msg.externalId) {

      const { data: existingMsg } = await supabase

        .from("messages")

        .select("id, body, status, conversation_id")

        .eq("tenant_id", account.tenant_id)

        .eq("external_id", msg.externalId)

        .maybeSingle();

      if (existingMsg) {

        const prevBody = (existingMsg as { body?: string | null }).body ?? "";

        const canUpgradeBody =

          msg.body &&

          msg.body !== ZAPI_PHONE_PLACEHOLDER &&

          prevBody === ZAPI_PHONE_PLACEHOLDER;

        const currentStatus = (existingMsg as { status?: DbMessageStatus | null }).status;

        const canUpgradeStatus =
          msg.messageStatus &&
          shouldUpgradeMessageStatus(currentStatus, msg.messageStatus);

        const media =
          canUpgradeBody && (msg.mediaUrl || msg.mediaBase64)
            ? await persistWhatsAppMedia(supabase, account, {
                tenantId: account.tenant_id,
                conversationId: (existingMsg as { conversation_id?: string }).conversation_id ?? "",
                messageId: existingMsg.id,
                externalId: msg.externalId,
                mediaUrl: msg.mediaUrl,
                mediaType: msg.mediaType,
                mediaBase64: msg.mediaBase64,
                mediaMimeType: msg.mediaMimeType,
                mediaFileName: msg.mediaFileName,
              })
            : null;

        if (canUpgradeBody || canUpgradeStatus) {

          await supabase

            .from("messages")

            .update({

              ...(canUpgradeBody
                ? {
                    body: msg.body,
                    media_url: media?.mediaUrl ?? msg.mediaUrl ?? null,
                    media_type: media?.mediaType ?? msg.mediaType ?? null,
                  }
                : {}),
              ...(canUpgradeStatus ? { status: msg.messageStatus } : {}),
            })

            .eq("id", existingMsg.id);

        }

        continue;

      }

    }

    if (msg.messageStatus && !msg.body && !msg.mediaUrl && !msg.mediaBase64) {
      continue;
    }



    const isInbound = msg.direction === "inbound";

    const phoneDigits = contactPhone ?? undefined;



    const leadId = await findOrCreateWhatsAppLead(supabase, account.tenant_id, {

      phone: phoneDigits,

      lid: contactLid,

      name: msg.contactName,

      ignoredNames: ignoredContactNames,

      stageId,

      pipelineId,

      referral: msg.referral || null,

    });



    if (!leadId) continue;

    void supabase
      .from("leads")
      .select("id, tenant_id, phone, custom_fields")
      .eq("id", leadId)
      .eq("tenant_id", account.tenant_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return null;
        return syncLeadWhatsAppProfilePicture(supabase, account, {
          id: data.id,
          tenant_id: data.tenant_id,
          phone: data.phone,
          custom_fields: (data.custom_fields as Record<string, unknown> | null) ?? null,
        });
      })
      .catch(() => null);



    const { data: existingConv } = await supabase

      .from("conversations")

      .select("id, unread_count, status")

      .eq("tenant_id", account.tenant_id)

      .eq("lead_id", leadId)

      .eq("channel", "whatsapp")

      .maybeSingle();



    let conversationId = existingConv?.id as string | undefined;

    if (!conversationId) {

      const { data: created } = await supabase

        .from("conversations")

        .insert({

          tenant_id: account.tenant_id,

          lead_id: leadId,

          whatsapp_account_id: account.id,

          channel: "whatsapp",

          last_message_at: msg.timestamp,

          unread_count: isInbound ? 1 : 0,

          status: isInbound ? "aguardando" : "em_atendimento",

        })

        .select("id")

        .single();

      conversationId = created?.id;

    } else {

      const unread = (existingConv as { unread_count?: number | null }).unread_count ?? 0;

      const nextStatus = isInbound ? "aguardando" : "em_atendimento";

      await supabase

        .from("conversations")

        .update({

          last_message_at: msg.timestamp,

          unread_count: isInbound ? unread + 1 : unread,

          status: nextStatus,

        })

        .eq("id", conversationId);

    }



    if (!conversationId) continue;

    const hasMedia = Boolean(msg.mediaType || msg.mediaUrl || msg.mediaBase64);

    let repliedMessageId: string | null = null;
    let replyBody = msg.quotedBody ?? null;
    let replySenderName = msg.quotedSenderName ?? null;
    if (msg.quotedMessageId) {
      const { data: replied } = await supabase
        .from("messages")
        .select("id, body, media_type, direction, user_id")
        .eq("tenant_id", account.tenant_id)
        .eq("conversation_id", conversationId)
        .eq("external_id", msg.quotedMessageId)
        .maybeSingle();
      if (replied) {
        repliedMessageId = replied.id as string;
        replyBody ||= (replied.body as string | null) ?? null;
        replySenderName ||= replied.direction === "outbound" ? "Você" : null;
      }
    }



    const { data: insertedMsg } = await supabase
      .from("messages")
      .insert({
        tenant_id: account.tenant_id,
        conversation_id: conversationId,
        direction: msg.direction,
        body: msg.body,
        media_url: hasMedia ? (msg.mediaUrl ?? null) : null,
        media_type: msg.mediaType ?? null,
        external_id: msg.externalId || null,
        reply_to_message_id: repliedMessageId,
        reply_to_external_id: msg.quotedMessageId ?? null,
        reply_to_body: replyBody,
        reply_to_sender_name: replySenderName,
        status: isInbound ? "delivered" : (msg.messageStatus ?? "sent"),
        created_at: msg.timestamp,
      })
      .select("id")
      .single();

    // Persiste midia (download/reupload) em segundo plano para nao atrasar a chegada da mensagem.
    if (hasMedia && insertedMsg?.id) {
      void persistWhatsAppMedia(supabase, account, {
        tenantId: account.tenant_id,
        conversationId,
        messageId: insertedMsg.id,
        externalId: msg.externalId,
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
        mediaBase64: msg.mediaBase64,
        mediaMimeType: msg.mediaMimeType,
        mediaFileName: msg.mediaFileName,
      })
        .then((media) =>
          supabase
            .from("messages")
            .update({ media_url: media.mediaUrl, media_type: media.mediaType })
            .eq("id", insertedMsg.id),
        )
        .catch(() => null);
    }
  }



  return NextResponse.json({ ok: true, parsed: messages.length });

}
