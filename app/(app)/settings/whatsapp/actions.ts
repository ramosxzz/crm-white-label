"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import type { WhatsAppAccount, WhatsAppProviderKind } from "@/lib/supabase/database.types";
import { getAppBaseUrl } from "@/lib/app-url";
import { syncLeadLidsFromZapiChats } from "@/lib/whatsapp/zapi-chats-sync";

async function syncZapiWebhooks(
  input: {
    provider: WhatsAppProviderKind;
    phone_number?: string;
    credentials: Record<string, unknown>;
  },
  tenantId: string,
) {
  if (input.provider !== "zapi") return;

  const { ZapiProvider } = await import("@/lib/whatsapp/zapi");
  const base = await getAppBaseUrl();
  const fakeAccount = {
    provider: "zapi" as const,
    phone_number: input.phone_number?.replace(/\D/g, "") ?? "",
    credentials: input.credentials,
  } as WhatsAppAccount;

  const zapi = new ZapiProvider(fakeAccount);
  await zapi.configureWebhooks(`${base}/api/webhooks/whatsapp/zapi`);
  const me = await zapi.getInstanceMe();

  const supabase = await createClient();
  const { data: acc } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("provider", "zapi")
    .maybeSingle();
  if (acc) await syncLeadLidsFromZapiChats(supabase, acc as WhatsAppAccount);

  input.credentials.notify_sent_by_me_enabled = true;
  input.credentials.receive_callback_sent_by_me = me.receiveCallbackSentByMe === true;
  input.credentials.webhooks_synced_at = new Date().toISOString();
  input.credentials.zapi_received_callback_url = me.receivedCallbackUrl ?? null;
}

async function syncEvolutionWebhook(input: {
  provider: WhatsAppProviderKind;
  credentials: Record<string, unknown>;
}) {
  if (input.provider !== "evolution") return;
  try {
    const { EvolutionProvider } = await import("@/lib/whatsapp/evolution");
    const base = await getAppBaseUrl();
    const fakeAccount = {
      provider: "evolution" as const,
      credentials: input.credentials,
    } as WhatsAppAccount;
    const evo = new EvolutionProvider(fakeAccount);
    await evo.configureWebhook(`${base}/api/webhooks/whatsapp/evolution`);
    input.credentials.webhooks_synced_at = new Date().toISOString();
  } catch (err) {
    // Não bloqueia o salvamento se a instância estiver fora do ar
    console.error("[evolution] configure webhook falhou", err);
  }
}

async function syncCloudApiWebhook(input: {
  provider: WhatsAppProviderKind;
  credentials: Record<string, unknown>;
}) {
  if (input.provider !== "cloud_api") return;
  try {
    const { CloudApiProvider } = await import("@/lib/whatsapp/cloud-api");
    const fakeAccount = {
      provider: "cloud_api" as const,
      credentials: input.credentials,
    } as WhatsAppAccount;
    const cloud = new CloudApiProvider(fakeAccount);
    await cloud.getPhoneNumberStatus();
    await cloud.subscribeWebhookApp();
    input.credentials.webhooks_synced_at = new Date().toISOString();
  } catch (err) {
    console.error("[cloud_api] validar/assinar webhook falhou", err);
  }
}

export async function saveWhatsAppAccount(input: {
  id?: string;
  provider: WhatsAppProviderKind;
  phone_number: string;
  display_name?: string;
  credentials: Record<string, unknown>;
  is_active: boolean;
}) {
  const ctx = await requireContext();
  if (ctx.role === "vendedor") throw new Error("Sem permissao");
  const supabase = await createClient();

  if (input.is_active) {
    await syncZapiWebhooks(input, ctx.tenantId);
    await syncEvolutionWebhook(input);
    await syncCloudApiWebhook(input);
  }

  if (input.id) {
    const { error } = await supabase
      .from("whatsapp_accounts")
      .update({
        provider: input.provider,
        phone_number: input.phone_number.replace(/\D/g, ""),
        display_name: input.display_name ?? null,
        credentials: input.credentials,
        is_active: input.is_active,
      })
      .eq("id", input.id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("whatsapp_accounts").insert({
      tenant_id: ctx.tenantId,
      provider: input.provider,
      phone_number: input.phone_number.replace(/\D/g, ""),
      display_name: input.display_name ?? null,
      credentials: input.credentials,
      is_active: input.is_active,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings/whatsapp");
  revalidatePath("/integrations/whatsapp");
}

export async function setWhatsAppAccountActive(input: { id: string; is_active: boolean }) {
  const ctx = await requireContext();
  if (ctx.role === "vendedor") throw new Error("Sem permissao");
  const supabase = await createClient();

  const { data: account, error: accountError } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw new Error("Conexao nao encontrada");

  const credentials = { ...((account as WhatsAppAccount).credentials as Record<string, unknown>) };
  const syncInput = {
    provider: (account as WhatsAppAccount).provider,
    phone_number: (account as WhatsAppAccount).phone_number,
    credentials,
  };

  if (input.is_active) {
    await syncZapiWebhooks(syncInput, ctx.tenantId);
    await syncEvolutionWebhook(syncInput);
    await syncCloudApiWebhook(syncInput);
  }

  const { error } = await supabase
    .from("whatsapp_accounts")
    .update({ is_active: input.is_active, credentials })
    .eq("id", input.id)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/whatsapp");
  revalidatePath("/integrations/whatsapp");
  revalidatePath("/chat");
}

export async function testWhatsAppConnection(input: {
  provider: WhatsAppProviderKind;
  credentials: Record<string, unknown>;
}) {
  const ctx = await requireContext();
  if (input.provider === "cloud_api") {
    const { CloudApiProvider } = await import("@/lib/whatsapp/cloud-api");
    const fakeAccount = {
      provider: "cloud_api" as const,
      credentials: input.credentials,
    } as WhatsAppAccount;

    try {
      const cloud = new CloudApiProvider(fakeAccount);
      const phone = await cloud.getPhoneNumberStatus();
      let webhookMessage = "Webhook precisa estar cadastrado no App Meta com a URL do CRM.";
      try {
        const sub = await cloud.subscribeWebhookApp();
        webhookMessage = sub.skipped
          ? "Informe o WABA ID para o CRM tentar assinar a conta nos webhooks automaticamente."
          : "WABA assinada nos webhooks do app.";
      } catch (err) {
        webhookMessage = `Telefone OK, mas a assinatura do webhook falhou: ${(err as Error).message}`;
      }
      const displayPhone = phone.display_phone_number ? ` (${phone.display_phone_number})` : "";
      const quality = phone.quality_rating ? ` Qualidade: ${phone.quality_rating}.` : "";
      return {
        ok: true,
        message: `Cloud API OK: ${phone.verified_name ?? phone.id}${displayPhone}.${quality} ${webhookMessage}`,
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  if (input.provider === "evolution") {
    const { EvolutionProvider } = await import("@/lib/whatsapp/evolution");
    const fakeAccount = {
      provider: "evolution" as const,
      credentials: input.credentials,
    } as WhatsAppAccount;

    try {
      const evo = new EvolutionProvider(fakeAccount);
      const status = await evo.getConnectionStatus();
      if (!status.connected) {
        return {
          ok: false,
          message:
            status.error ??
            `Evolution desconectada (${status.state ?? "sem estado"}). Reconecte o WhatsApp no painel Evolution e teste novamente.`,
        };
      }
      const base = await getAppBaseUrl();
      await evo.configureWebhook(`${base}/api/webhooks/whatsapp/evolution`);
      if (input.credentials && typeof input.credentials === "object") {
        input.credentials.webhooks_synced_at = new Date().toISOString();
      }
      return {
        ok: true,
        message: "Evolution conectada. Webhook do CRM configurado para receber mensagens.",
      };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  }

  if (input.provider !== "zapi") {
    return { ok: false, message: "Teste automático disponível apenas para Evolution e Z-API." };
  }

  const { ZapiProvider } = await import("@/lib/whatsapp/zapi");
  const fakeAccount = {
    provider: "zapi" as const,
    credentials: input.credentials,
  } as WhatsAppAccount;

  try {
    const zapi = new ZapiProvider(fakeAccount);
    const status = await zapi.getConnectionStatus();
    if (!status.connected) {
      return {
        ok: false,
        message:
          status.error ??
          "Instância desconectada. No painel Z-API, conecte o WhatsApp (QR Code) e tente de novo.",
      };
    }
    const base = await getAppBaseUrl();
    await zapi.configureWebhooks(`${base}/api/webhooks/whatsapp/zapi`);
    const me = await zapi.getInstanceMe();

    const supabase = await createClient();
    const { data: acc } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("provider", "zapi")
      .maybeSingle();
    const lidsSynced = acc ? await syncLeadLidsFromZapiChats(supabase, acc as WhatsAppAccount) : 0;

    if (input.credentials && typeof input.credentials === "object") {
      const creds = input.credentials as Record<string, unknown>;
      creds.notify_sent_by_me_enabled = true;
      creds.receive_callback_sent_by_me = me.receiveCallbackSentByMe === true;
      creds.webhooks_synced_at = new Date().toISOString();
    }
    const sentByMe = me.receiveCallbackSentByMe ? "Ativo" : "Desativado na API";
    return {
      ok: true,
      message: status.smartphoneConnected
        ? `Z-API OK. Celular online. Webhook celular: ${sentByMe}. ${lidsSynced} contato(s) vinculado(s) ao @lid.`
        : `Z-API OK. Verifique celular no painel. Webhook celular: ${sentByMe}. ${lidsSynced} @lid vinculado(s).`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
