import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

import { createProvider } from "@/lib/whatsapp/factory";

import { ensureZapiPhoneMessageSync } from "@/lib/whatsapp/ensure-zapi-phone-sync";

import { ZAPI_PHONE_PLACEHOLDER } from "@/lib/whatsapp/zapi";

import { unwrapZapiPayloadForLog } from "@/lib/whatsapp/zapi-log";

import { findOrCreateWhatsAppLead } from "@/lib/leads/find-or-create";
import { toJson } from "@/lib/utils";

import { applyMessageStatusUpdates } from "@/lib/whatsapp/apply-message-status";
import { isSelfWhatsAppContact } from "@/lib/whatsapp/self-contact";
import { persistWhatsAppMedia } from "@/lib/whatsapp/media-storage";
import { syncLeadWhatsAppProfilePicture } from "@/lib/whatsapp/profile-picture";
import {
  parseZapiMessageStatusUpdates,
  shouldUpgradeMessageStatus,
} from "@/lib/whatsapp/zapi-status";
import { parseEvolutionMessageStatusUpdates } from "@/lib/whatsapp/evolution-status";
import { recordAccountHealthHeartbeat } from "@/lib/whatsapp/health-checker";
import { parseEvolutionPresenceUpdate } from "@/lib/whatsapp/evolution-presence";
import { findLeadByContact } from "@/lib/leads/find-by-contact";

import { isValidWhatsAppPhone, normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";

import { getAiAgentReply } from "@/lib/ai/agent";

import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { dispatchWebhookEvent } from "@/lib/api/dispatch-webhook";
import { nextConversationUnreadCount } from "@/lib/chat/unread-count";

import type { Message, WhatsAppAccount, WhatsAppProviderKind } from "@/lib/supabase/database.types";

import {
  collectNestedStringValues,
  matchCloudApiAccount,
  matchZapiAccount,
  matchEvolutionAccount,
  isCrossTenantDuplicate,
} from "@/lib/whatsapp/webhook-account-match";



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



  // NUNCA assume uma conta por default (nem quando ha so uma ativa, nem quando
  // todas as contas ativas sao do mesmo tenant): exige match explicito por
  // identificador seguro (instance/instanceId/phone_number_id). Sem
  // match, o payload e ignorado — jamais atribuido a um tenant "palpite", que
  // foi exatamente a causa dos vazamentos anteriores entre tenants.
  let account: WhatsAppAccount | null = null;

  if (provider === "cloud_api") {

    const entry = (payload as { entry?: Array<{ changes?: Array<{ value?: { metadata?: { display_phone_number?: string; phone_number_id?: string } } }> }> }).entry?.[0];

    const metadata = entry?.changes?.[0]?.value?.metadata;
    account = matchCloudApiAccount(accounts, metadata);

  }

  if (provider === "zapi") {

    const raw = payload as { instanceId?: string; data?: { instanceId?: string } };

    const instanceId = raw.instanceId ?? raw.data?.instanceId;

    account = matchZapiAccount(accounts, instanceId);

  }

  if (provider === "evolution") {

    const raw = payload as {
      apikey?: string;
      instance?: string;
      instanceName?: string;
      instanceId?: string;
      server_url?: string;
      sender?: string;
      data?: Record<string, unknown>;
    };
    const data = raw.data;

    const instanceCandidates = [
      raw.instance,
      raw.instanceName,
      raw.instanceId,
      data?.instance,
      data?.instanceName,
      data?.instanceId,
      ...collectNestedStringValues(payload, [
        "instance",
        "instanceName",
        "instanceId",
        "instance_id",
      ]),
    ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

    account = matchEvolutionAccount(accounts, {
      instanceCandidates,
      apikey: raw.apikey,
      server_url: raw.server_url,
    });

    // NAO usar match por sufixo de telefone (sender/owner/ownerJid via endsWith):
    // digitos curtos ou formatacao inconsistente (com/sem 55, com/sem 9) podem
    // colidir por coincidencia entre contas de tenants diferentes. Foi a causa
    // de um vazamento real (mensagens da Avante Digital atribuidas a Atacado
    // Moda Sul). Tambem NAO aceitar apikey/base_url como match principal, pois
    // varias instancias podem compartilhar a mesma API key ou o mesmo servidor.
    if (!account && instanceCandidates.length === 0) {
      console.error("[webhook][evolution] payload sem instance/instanceId; ignorado para evitar vazamento entre tenants.");
    } else if (!account) {
      console.error("[webhook][evolution] instance nao encontrada em conta ativa; payload ignorado para evitar vazamento entre tenants.", {
        candidates: instanceCandidates,
        event: (payload as { event?: string }).event,
      });
    }

  }

  if (!account) {
    console.error(
      `[webhook][${provider}] nao foi possivel identificar a conta do tenant (${accounts.length} contas ativas). Ignorando payload para evitar vazamento entre tenants.`,
    );
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
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
      payload: toJson(payload),
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
      payload: toJson(payload),
    });

    // A Evolution avisa quando a sessao conecta, cai ou desloga - sem isso
    // a gente so descobria "desconectado" na proxima tentativa de mandar
    // mensagem (com o cliente ja reclamando que sumiu resposta). Cobre os
    // dois formatos de nome de evento vistos em versoes diferentes da
    // Evolution (maiusculo com underscore, minusculo com ponto).
    if (evoPayload.event === "connection.update" || evoPayload.event === "CONNECTION_UPDATE") {
      const state = (payload as { data?: { state?: string } })?.data?.state;
      const status = state === "open" ? "healthy" : state === "connecting" ? "warning" : "offline";
      await recordAccountHealthHeartbeat(
        supabase,
        account.id,
        status,
        status === "healthy" ? null : `Evolution: conexao "${state ?? "desconhecida"}"`,
      );
      return NextResponse.json({ ok: true, connectionState: state ?? null });
    }

    const statusUpdates = parseEvolutionMessageStatusUpdates(payload);
    if (statusUpdates.length > 0) {
      const applied = await applyMessageStatusUpdates(supabase, account.tenant_id, statusUpdates);
      return NextResponse.json({ ok: true, parsed: 0, statusUpdates: applied });
    }

    if (evoPayload.event === "presence.update") {
      const presence = parseEvolutionPresenceUpdate(payload);
      if (presence) {
        // So atualiza conversa que ja existe - "digitando" de um contato sem
        // conversa nenhuma nao serve pra nada e nao deve criar lead.
        const lead = await findLeadByContact(supabase, account.tenant_id, { phone: presence.phone });
        const { data: conversation } = lead
          ? await supabase
              .from("conversations")
              .select("id")
              .eq("tenant_id", account.tenant_id)
              .eq("lead_id", lead.id)
              .eq("whatsapp_account_id", account.id)
              .maybeSingle()
          : { data: null };

        if (conversation) {
          if (presence.state) {
            await supabase.from("conversation_presence").upsert({
              tenant_id: account.tenant_id,
              conversation_id: conversation.id,
              state: presence.state,
              updated_at: new Date().toISOString(),
            });
          } else {
            await supabase.from("conversation_presence").delete().eq("conversation_id", conversation.id);
          }
        }
      }
      return NextResponse.json({ ok: true, parsed: 0 });
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
      payload: toJson(payload),
    });
  }



  for (const msg of messages) {

    const contactPhone = msg.contactPhone ?? (msg.fromPhone.includes("@lid") ? null : normalizeWhatsAppPhone(msg.fromPhone));

    const contactLid = msg.contactLid ?? null;



    if (!contactPhone && !contactLid) continue;

    if (contactPhone && !isValidWhatsAppPhone(contactPhone)) continue;

    if (isSelfWhatsAppContact(account, { phone: contactPhone, lid: contactLid })) continue;

    // externalId e o id da mensagem no WhatsApp. Duas contas conectadas do
    // MESMO tenant conversando entre si (ex: duas atendentes se falando pelos
    // proprios numeros comerciais) geram o MESMO externalId em duas
    // conversas diferentes - cada instancia entrega seu proprio webhook. Por
    // isso a unicidade e por (conversation_id, external_id), nao global; so
    // sabemos a conversa mais abaixo, entao guardamos o achado daqui pra usar
    // la (reentrega de verdade = mesma conversa; instancia irma = conversa
    // diferente, insere normalmente).
    // Deriva do Message real (banco): status e conversation_id nao sao
    // nullable na tabela - declarar nullable aqui a mao (como antes) fazia o
    // predicado de tipo abaixo falhar, porque um tipo mais permissivo que a
    // linha real nunca e um subtipo valido dela.
    type ExistingMsgRow = Pick<Message, "id" | "tenant_id" | "body" | "status" | "conversation_id">;
    let sameTenantRowsWithExternalId: ExistingMsgRow[] = [];

    if (msg.externalId) {

      // Busca GLOBAL (sem filtro de tenant_id): pode haver mais de uma linha
      // agora (uma por conversa/instancia). Se alguma pertence a OUTRO
      // tenant, e reentrega/retry do mesmo evento (Evolution reenvia ate
      // 10x) batendo em outra conta - nunca deve ser inserida de novo em
      // tenant nenhum (evita duplicacao e vazamento entre tenants).
      const { data: existingRows } = await supabase

        .from("messages")

        .select("id, tenant_id, body, status, conversation_id")

        .eq("external_id", msg.externalId);

      const crossTenantMatch = (existingRows ?? []).find((row) =>
        isCrossTenantDuplicate(row, account.tenant_id),
      );
      if (crossTenantMatch) {
        console.error(
          `[webhook][${provider}] external_id ${msg.externalId} ja pertence ao tenant ${crossTenantMatch.tenant_id}, ignorando entrega duplicada para o tenant ${account.tenant_id}.`,
        );
        continue;
      }

      sameTenantRowsWithExternalId = (existingRows ?? []).filter(
        (row): row is ExistingMsgRow => row.tenant_id === account.tenant_id,
      );
    }

    if (msg.messageStatus && !msg.body && !msg.mediaUrl && !msg.mediaBase64) {
      continue;
    }



    const isInbound = msg.direction === "inbound";

    const phoneDigits = contactPhone ?? undefined;



    const leadResult = await findOrCreateWhatsAppLead(supabase, account.tenant_id, {

      phone: phoneDigits,

      lid: contactLid,

      name: msg.contactName,

      ignoredNames: ignoredContactNames,

      stageId,

      pipelineId,

      referral: msg.referral || null,

      receivingAccountOwnerId: account.assigned_to ?? null,

    });



    if (!leadResult) continue;
    const leadId = leadResult.id;

    // Sem isso, automacoes com gatilho "lead criado" nunca disparavam pra
    // leads que chegam pelo WhatsApp (a maioria) - so funcionava pra leads
    // criados manualmente ou pela API publica, que ja chamam esse trigger.
    if (leadResult.created) {
      void fireAutomationTrigger(account.tenant_id, "lead_created", leadId, { source: "whatsapp" });
    }

    // IIFE em vez de encadear .then().catch() direto no builder: o builder do
    // Postgrest e so "thenable" (PromiseLike), nao Promise completo, entao nao
    // tem .catch() proprio - encadear quebra o tipo mesmo funcionando em runtime.
    void (async () => {
      try {
        const { data } = await supabase
          .from("leads")
          .select("id, tenant_id, phone, custom_fields")
          .eq("id", leadId)
          .eq("tenant_id", account.tenant_id)
          .maybeSingle();
        if (!data) return;
        await syncLeadWhatsAppProfilePicture(supabase, account, {
          id: data.id,
          tenant_id: data.tenant_id,
          phone: data.phone,
          custom_fields: (data.custom_fields as Record<string, unknown> | null) ?? null,
        });
      } catch {
        // melhor esforco - nao pode derrubar o webhook por causa da foto de perfil
      }
    })();



    const { data: existingConv } = await supabase

      .from("conversations")

      .select("id, unread_count, status")

      .eq("tenant_id", account.tenant_id)

      .eq("lead_id", leadId)

      .eq("channel", "whatsapp")

      .maybeSingle();



    // Atribuicao de anuncio pelo emoji da mensagem de abertura, para quando o
    // referral do Click-to-WhatsApp nao vem (caso da Evolution API). Só no
    // primeiro contato: a ausencia de conversa e o sinal de que esta e a
    // primeira mensagem desse lead, e emoji no meio de um papo em andamento
    // nao diz origem nenhuma.
    if (isInbound && !existingConv && msg.body && !msg.referral) {
      const { applyAdSignatureToLead } = await import("@/lib/meta/apply-ad-signature");
      void applyAdSignatureToLead(supabase, account.tenant_id, leadId, msg.body);
    }

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

          unread_count: nextConversationUnreadCount(
            unread,
            isInbound ? "inbound" : "outbound",
          ),

          status: nextStatus,

          // Autocura: conversa antiga sem numero vinculado (ou vinculada a
          // outro numero de uma entrega anterior) ficava invisivel pra
          // vendedor quando o tenant separa por numero - o dono do numero
          // que realmente entregou essa mensagem agora e sempre a fonte da
          // verdade, nao o que foi gravado da primeira vez.
          whatsapp_account_id: account.id,

        })

        .eq("id", conversationId);

    }



    if (!conversationId) continue;

    // So agora sabemos a conversa: se o mesmo external_id ja esta gravado
    // NESSA conversa, e reentrega de verdade (retry do provider) - atualiza
    // no lugar em vez de duplicar. Se so existe em OUTRA conversa do mesmo
    // tenant, e a instancia irma da mesma mensagem (duas contas nossas se
    // falando) - segue pro insert normal abaixo, cada conversa com sua copia.
    const existingMsgSameConversation = sameTenantRowsWithExternalId.find(
      (row) => row.conversation_id === conversationId,
    );
    if (existingMsgSameConversation) {
      const prevBody = existingMsgSameConversation.body ?? "";

      const canUpgradeBody =
        msg.body &&
        msg.body !== ZAPI_PHONE_PLACEHOLDER &&
        prevBody === ZAPI_PHONE_PLACEHOLDER;

      const canUpgradeStatus =
        msg.messageStatus &&
        shouldUpgradeMessageStatus(existingMsgSameConversation.status, msg.messageStatus);

      const media =
        canUpgradeBody && (msg.mediaUrl || msg.mediaBase64)
          ? await persistWhatsAppMedia(supabase, account, {
              tenantId: account.tenant_id,
              conversationId,
              messageId: existingMsgSameConversation.id,
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
          .eq("id", existingMsgSameConversation.id);
      }

      continue;
    }

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



    const { data: insertedMsg, error: insertMsgError } = await supabase
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

    if (insertMsgError) {
      // 23505 = violacao da unique constraint em external_id: outra entrega
      // concorrente (retry da Evolution) ja inseriu essa mesma mensagem.
      // Ignora silenciosamente em vez de duplicar.
      if (insertMsgError.code === "23505") continue;
      console.error(`[webhook][${provider}] erro ao inserir mensagem:`, insertMsgError);
      continue;
    }

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

    if (isInbound && insertedMsg?.id && msg.body) {
      try {
        const replyText = await getAiAgentReply(supabase, {
          tenantId: account.tenant_id,
          leadId,
          conversationId,
          incomingBody: msg.body,
        });
        if (replyText) {
          const aiAdapter = createProvider(account);
          const sendResult = await aiAdapter.send({ to: contactPhone ?? account.phone_number, body: replyText });
          await supabase.from("messages").insert({
            tenant_id: account.tenant_id,
            conversation_id: conversationId,
            direction: "outbound",
            body: replyText,
            status: sendResult.status === "sent" ? "sent" : "failed",
            error: sendResult.status === "sent" ? null : "Falha ao enviar resposta da IA",
            external_id: sendResult.externalId ?? null,
            is_ai_generated: true,
          });
          if (sendResult.status === "sent") {
            await supabase
              .from("conversations")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", conversationId);
          }
        }
      } catch (err) {
        console.error("[ia w+] erro ao responder automaticamente:", err);
      }
    }

    // Dispara automacoes de "mensagem recebida" (respeita o toggle por lead internamente).
    if (isInbound && leadId) {
      void fireAutomationTrigger(account.tenant_id, "message_received", leadId, {
        conversation_id: conversationId,
        body: msg.body ?? "",
      });
      void dispatchWebhookEvent(account.tenant_id, "message.received", {
        lead_id: leadId,
        conversation_id: conversationId,
        body: msg.body ?? null,
      });
    }
  }



  return NextResponse.json({ ok: true, parsed: messages.length });

}
