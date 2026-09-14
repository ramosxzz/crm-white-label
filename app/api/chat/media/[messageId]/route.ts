import { NextRequest, NextResponse } from "next/server";

import { requireContext } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";
import {
  defaultContentType,
  fetchEvolutionMediaBase64,
  isWhatsAppEncryptedMediaUrl,
  persistWhatsAppMedia,
} from "@/lib/whatsapp/media-storage";
import { getR2Object, isR2Url, r2KeyFromUrl } from "@/lib/storage/r2";
import {
  canAccessConversationAccount,
  getChatAccountVisibility,
} from "@/lib/chat/list-conversation-items";

type CloudApiCredentials = {
  access_token?: string;
};

function responseError(message: string, status = 404) {
  return new NextResponse(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function fetchCloudApiMedia(account: WhatsAppAccount, mediaRef: string, range: string | null) {
  const mediaId = mediaRef.replace(/^cloud_api:/, "").trim();
  const creds = account.credentials as CloudApiCredentials;
  const token = creds.access_token?.trim();
  if (!mediaId || !token) return responseError("Midia Meta sem credenciais", 404);

  let metaRes: Response;
  try {
    metaRes = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_MEDIA_TIMEOUT_MS),
    });
  } catch {
    return responseError("Meta demorou demais para responder", 504);
  }
  const meta = (await metaRes.json().catch(() => null)) as {
    url?: string;
    mime_type?: string;
  } | null;

  if (!metaRes.ok || !meta?.url) {
    return responseError("Nao foi possivel localizar a midia na Meta", 404);
  }

  return fetchUpstreamMedia(meta.url, {
    authorization: `Bearer ${token}`,
    contentType: meta.mime_type,
    range,
  });
}

const UPSTREAM_MEDIA_TIMEOUT_MS = 15_000;

async function fetchUpstreamMedia(
  url: string,
  input: { authorization?: string; contentType?: string; range: string | null },
) {
  const headers: Record<string, string> = {
    "User-Agent": "SolaireCRM/1.0",
  };
  if (input.authorization) headers.Authorization = input.authorization;
  if (input.range) headers.Range = input.range;

  // Sem timeout, um servidor de origem lento/travado (Evolution self-hosted,
  // Meta) deixa a requisicao pendurada indefinidamente - o navegador fica
  // "travado" esperando a midia carregar. Falha rapido em vez disso.
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(UPSTREAM_MEDIA_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return responseError(
      timedOut ? "Servidor de midia demorou demais para responder" : "Falha ao buscar midia",
      504,
    );
  }

  if (!upstream.ok || !upstream.body) {
    return responseError("Arquivo de midia indisponivel", upstream.status === 404 ? 404 : 502);
  }

  const outHeaders = new Headers();
  outHeaders.set("Cache-Control", "private, max-age=120");
  outHeaders.set("Content-Type", upstream.headers.get("content-type") ?? input.contentType ?? "application/octet-stream");
  for (const header of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(header);
    if (value) outHeaders.set(header, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

async function fetchR2Media(mediaUrl: string, range: string | null, contentType?: string | null) {
  const object = await getR2Object({ key: r2KeyFromUrl(mediaUrl), range }).catch((error) => {
    console.error("[chat-media] leitura R2 falhou", error);
    return null;
  });
  if (!object?.Body) return responseError("Arquivo de midia indisponivel", 404);

  const outHeaders = new Headers();
  outHeaders.set("Cache-Control", "private, max-age=31536000, immutable");
  outHeaders.set("Content-Type", object.ContentType ?? contentType ?? "application/octet-stream");
  if (object.ContentLength != null) outHeaders.set("Content-Length", String(object.ContentLength));
  if (object.ContentRange) outHeaders.set("Content-Range", object.ContentRange);
  outHeaders.set("Accept-Ranges", "bytes");

  const body = object.Body.transformToWebStream();
  return new Response(body, {
    status: object.ContentRange ? 206 : 200,
    headers: outHeaders,
  });
}

type StoredMessage = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  media_url: string | null;
  media_type: string | null;
  external_id: string | null;
};

/**
 * Recupera midias cujo arquivo antigo foi perdido na migracao do storage.
 * A Evolution ainda consegue reconstruir o arquivo pelo ID original da
 * mensagem; depois da primeira leitura ele fica persistido no R2 e as
 * proximas aberturas nao dependem mais do historico da Evolution.
 */
async function recoverEvolutionMedia(
  supabase: ReturnType<typeof createServiceClient>,
  db: any,
  account: WhatsAppAccount | null,
  message: StoredMessage,
  range: string | null,
) {
  if (account?.provider !== "evolution" || !message.external_id) return null;

  const recovered = await fetchEvolutionMediaBase64(
    account,
    message.external_id,
    message.media_type,
  ).catch((error) => {
    console.error(`[chat-media] recuperacao Evolution falhou para ${message.id}`, error);
    return null;
  });
  if (!recovered?.base64) return null;

  const media = await persistWhatsAppMedia(supabase, account, {
    tenantId: message.tenant_id,
    conversationId: message.conversation_id,
    messageId: message.id,
    externalId: message.external_id,
    mediaUrl: message.media_url,
    mediaType: message.media_type,
    mediaBase64: recovered.base64,
    mediaMimeType: recovered.mimetype,
    mediaFileName: recovered.fileName,
  });
  if (!media.mediaUrl || media.mediaUrl === message.media_url) return null;

  const { error } = await db
    .from("messages")
    .update({ media_url: media.mediaUrl, media_type: media.mediaType })
    .eq("id", message.id)
    .eq("tenant_id", message.tenant_id);
  if (error) {
    console.error(`[chat-media] nao foi possivel persistir recuperacao de ${message.id}`, error);
    return null;
  }

  if (isR2Url(media.mediaUrl)) {
    return fetchR2Media(
      media.mediaUrl,
      range,
      media.mediaType ?? defaultContentType(message.media_type),
    );
  }
  return fetchUpstreamMedia(media.mediaUrl, {
    range,
    contentType: media.mediaType ?? defaultContentType(message.media_type),
  });
}

export async function GET(req: NextRequest, props: { params: Promise<{ messageId: string }> }) {
  const ctx = await requireContext();
  const { messageId } = await props.params;
  const supabase = createServiceClient();
  const db = supabase as any;

  const { data: rawMessage } = await db
    .from("messages")
    .select("id, tenant_id, conversation_id, media_url, media_type, external_id")
    .eq("id", messageId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  const message = rawMessage as StoredMessage | null;
  const mediaUrl = typeof message?.media_url === "string" ? message.media_url.trim() : "";
  if (!message || !mediaUrl) return responseError("Midia nao encontrada", 404);

  const { data: rawConversation } = await db
    .from("conversations")
    .select("whatsapp_account_id")
    .eq("id", message.conversation_id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  const conversation = rawConversation as { whatsapp_account_id: string | null } | null;
  const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
  if (
    !conversation ||
    !canAccessConversationAccount(conversation.whatsapp_account_id, visibility)
  ) {
    return responseError("Midia nao encontrada", 404);
  }
  const accountId = conversation?.whatsapp_account_id;
  const { data: account } = accountId
    ? await db
        .from("whatsapp_accounts")
        .select("*")
        .eq("id", accountId)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle()
    : { data: null };

  const range = req.headers.get("range");

  if (mediaUrl.startsWith("cloud_api:")) {
    if (!account) return responseError("Conta do WhatsApp nao encontrada", 404);
    return fetchCloudApiMedia(account as WhatsAppAccount, mediaUrl, range);
  }

  if (isR2Url(mediaUrl)) {
    const stored = await fetchR2Media(mediaUrl, range, defaultContentType(message.media_type));
    if (stored.ok) return stored;
    return (
      await recoverEvolutionMedia(
        supabase,
        db,
        (account as WhatsAppAccount | null) ?? null,
        message,
        range,
      )
    ) ?? stored;
  }

  if (account && (account as WhatsAppAccount).provider === "evolution" && isWhatsAppEncryptedMediaUrl(mediaUrl)) {
    const media = await persistWhatsAppMedia(supabase, account as WhatsAppAccount, {
      tenantId: ctx.tenantId,
      conversationId: message.conversation_id,
      messageId: message.id,
      externalId: message.external_id,
      mediaUrl,
      mediaType: message.media_type,
    });

    if (media.mediaUrl && media.mediaUrl !== mediaUrl) {
      await db
        .from("messages")
        .update({ media_url: media.mediaUrl, media_type: media.mediaType })
        .eq("id", message.id)
        .eq("tenant_id", ctx.tenantId);

      return fetchUpstreamMedia(media.mediaUrl, {
        range,
        contentType: media.mediaType ?? defaultContentType(message.media_type),
      });
    }
  }

  if (!/^https?:\/\//i.test(mediaUrl)) {
    return responseError("Link de midia invalido ou expirado", 404);
  }

  const upstream = await fetchUpstreamMedia(mediaUrl, {
    range,
    contentType: defaultContentType(message.media_type),
  });
  if (upstream.ok) return upstream;

  return (
    await recoverEvolutionMedia(
      supabase,
      db,
      (account as WhatsAppAccount | null) ?? null,
      message,
      range,
    )
  ) ?? upstream;
}
