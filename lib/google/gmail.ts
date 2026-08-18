import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshGoogleToken } from "./oauth";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GoogleAccountRow {
  id: string;
  google_email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

/** Retorna um access_token valido, renovando via refresh_token se estiver perto de expirar. */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ accessToken: string; googleEmail: string } | null> {
  const { data: account } = await supabase
    .from("google_accounts")
    .select("id, google_email, access_token, refresh_token, token_expiry")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!account) return null;

  const row = account as GoogleAccountRow;
  const expiresInMs = new Date(row.token_expiry).getTime() - Date.now();
  if (expiresInMs > 60_000) {
    return { accessToken: row.access_token, googleEmail: row.google_email };
  }

  const refreshed = await refreshGoogleToken(row.refresh_token);
  const tokenExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_accounts")
    .update({ access_token: refreshed.access_token, token_expiry: tokenExpiry, updated_at: new Date().toISOString() })
    .eq("id", row.id);

  return { accessToken: refreshed.access_token, googleEmail: row.google_email };
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
}

function headerValue(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Busca as ultimas mensagens trocadas com o email do lead (recebidas ou enviadas). */
export async function listLeadEmails(accessToken: string, leadEmail: string): Promise<GmailMessageSummary[]> {
  const query = `from:${leadEmail} OR to:${leadEmail}`;
  const searchRes = await fetch(
    `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!searchRes.ok) throw new Error(`Falha ao buscar emails: ${await searchRes.text()}`);
  const { messages } = (await searchRes.json()) as { messages?: { id: string; threadId: string }[] };
  if (!messages || messages.length === 0) return [];

  const details = await Promise.all(
    messages.map(async (m) => {
      const res = await fetch(
        `${GMAIL_API}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const headers = (data.payload?.headers ?? []) as { name: string; value: string }[];
      return {
        id: data.id as string,
        threadId: data.threadId as string,
        from: headerValue(headers, "From"),
        to: headerValue(headers, "To"),
        subject: headerValue(headers, "Subject"),
        snippet: (data.snippet as string) ?? "",
        date: headerValue(headers, "Date"),
      };
    }),
  );

  return details
    .filter((d): d is GmailMessageSummary => d !== null)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export interface InboxThreadSummary {
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
}

/** Lista as threads mais recentes da caixa de entrada (qualquer remetente). */
export async function listInboxThreads(accessToken: string, maxResults = 25): Promise<InboxThreadSummary[]> {
  const res = await fetch(
    `${GMAIL_API}/threads?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Falha ao listar caixa de entrada: ${await res.text()}`);
  const { threads } = (await res.json()) as { threads?: { id: string; snippet: string }[] };
  if (!threads || threads.length === 0) return [];

  const details = await Promise.all(
    threads.map(async (t) => {
      const detailRes = await fetch(
        `${GMAIL_API}/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!detailRes.ok) return null;
      const data = await detailRes.json();
      const lastMsg = data.messages?.[data.messages.length - 1];
      if (!lastMsg) return null;
      const headers = (lastMsg.payload?.headers ?? []) as { name: string; value: string }[];
      const unread = (data.messages as { labelIds?: string[] }[]).some((m) =>
        (m.labelIds ?? []).includes("UNREAD"),
      );
      return {
        threadId: data.id as string,
        from: headerValue(headers, "From"),
        subject: headerValue(headers, "Subject"),
        snippet: (t.snippet as string) ?? "",
        date: headerValue(headers, "Date"),
        unread,
      };
    }),
  );

  return details
    .filter((d): d is InboxThreadSummary => d !== null)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface GmailFullMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyHtml: string;
  attachments: GmailAttachment[];
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  headers?: { name: string; value: string }[];
  parts?: GmailPart[];
};

function findPartByMimeType(payload: GmailPart, mimeType: string): GmailPart | null {
  if (payload.mimeType === mimeType && payload.body?.data) return payload;
  for (const part of payload.parts ?? []) {
    const found = findPartByMimeType(part, mimeType);
    if (found) return found;
  }
  return null;
}

/** Acha partes inline (imagens referenciadas no HTML via cid:) em qualquer nivel da arvore. */
function collectInlineImageParts(payload: GmailPart): { contentId: string; attachmentId: string; mimeType: string }[] {
  const found: { contentId: string; attachmentId: string; mimeType: string }[] = [];
  const contentId = headerValue(payload.headers ?? [], "Content-ID").replace(/^<|>$/g, "");
  if (contentId && payload.body?.attachmentId && payload.mimeType?.startsWith("image/")) {
    found.push({ contentId, attachmentId: payload.body.attachmentId, mimeType: payload.mimeType });
  }
  for (const part of payload.parts ?? []) {
    found.push(...collectInlineImageParts(part));
  }
  return found;
}

/** Acha anexos "de verdade" (com nome de arquivo, nao imagem inline referenciada por cid:). */
function collectAttachments(payload: GmailPart): GmailAttachment[] {
  const found: GmailAttachment[] = [];
  if (payload.filename && payload.body?.attachmentId) {
    found.push({
      attachmentId: payload.body.attachmentId,
      filename: payload.filename,
      mimeType: payload.mimeType ?? "application/octet-stream",
      size: payload.body.size ?? 0,
    });
  }
  for (const part of payload.parts ?? []) {
    found.push(...collectAttachments(part));
  }
  return found;
}

export async function fetchAttachmentDataUri(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  mimeType: string,
): Promise<string | null> {
  const res = await fetch(`${GMAIL_API}/messages/${messageId}/attachments/${attachmentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const { data } = (await res.json()) as { data?: string };
  if (!data) return null;
  const standardBase64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return `data:${mimeType};base64,${standardBase64}`;
}

/** Monta o corpo em HTML da mensagem, com imagens inline (cid:) resolvidas pra data URI. */
async function buildMessageHtml(accessToken: string, messageId: string, payload: GmailPart): Promise<string> {
  const htmlPart = findPartByMimeType(payload, "text/html");
  if (htmlPart?.body?.data) {
    let html = decodeBase64Url(htmlPart.body.data);
    const inlineImages = collectInlineImageParts(payload);
    if (inlineImages.length > 0) {
      const resolved = await Promise.all(
        inlineImages.map(async (img) => ({
          contentId: img.contentId,
          dataUri: await fetchAttachmentDataUri(accessToken, messageId, img.attachmentId, img.mimeType),
        })),
      );
      for (const img of resolved) {
        if (!img.dataUri) continue;
        html = html.split(`cid:${img.contentId}`).join(img.dataUri);
      }
    }
    return html;
  }

  const plainPart = findPartByMimeType(payload, "text/plain");
  const plainText = plainPart?.body?.data ? decodeBase64Url(plainPart.body.data) : "";
  return `<pre style="font-family:inherit;white-space:pre-wrap;margin:0">${escapeHtml(plainText.trim())}</pre>`;
}

/** Busca todas as mensagens de uma thread, com corpo em HTML (imagens inline resolvidas). */
export async function getGmailThread(accessToken: string, threadId: string): Promise<GmailFullMessage[]> {
  const res = await fetch(`${GMAIL_API}/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Falha ao abrir thread: ${await res.text()}`);
  const data = await res.json();
  const messages = (data.messages ?? []) as { id: string; payload: GmailPart }[];

  return Promise.all(
    messages.map(async (msg) => {
      const headers = msg.payload?.headers ?? [];
      return {
        id: msg.id,
        from: headerValue(headers, "From"),
        to: headerValue(headers, "To"),
        subject: headerValue(headers, "Subject"),
        date: headerValue(headers, "Date"),
        bodyHtml: await buildMessageHtml(accessToken, msg.id, msg.payload),
        attachments: collectAttachments(msg.payload),
      };
    }),
  );
}

/** Remove a label UNREAD da thread (marca como lida) - o mesmo que abrir no Gmail. */
export async function markThreadRead(accessToken: string, threadId: string): Promise<void> {
  await fetch(`${GMAIL_API}/threads/${threadId}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

function encodeBase64Url(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Responde uma thread existente (mesmo threadId, cabecalhos In-Reply-To/References corretos). */
export async function sendGmailReply(
  accessToken: string,
  params: { threadId: string; to: string; subject: string; inReplyTo: string; body: string },
): Promise<void> {
  const subject = params.subject.toLowerCase().startsWith("re:") ? params.subject : `Re: ${params.subject}`;
  const raw = [
    `To: ${params.to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${params.inReplyTo}`,
    `References: ${params.inReplyTo}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    params.body,
  ].join("\r\n");

  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encodeBase64Url(raw), threadId: params.threadId }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar resposta: ${await res.text()}`);
}
