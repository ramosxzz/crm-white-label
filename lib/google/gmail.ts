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

export interface GmailFullMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyText: string;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractPlainTextBody(payload: any): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainTextBody(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

/** Busca todas as mensagens de uma thread, com corpo em texto plano. */
export async function getGmailThread(accessToken: string, threadId: string): Promise<GmailFullMessage[]> {
  const res = await fetch(`${GMAIL_API}/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Falha ao abrir thread: ${await res.text()}`);
  const data = await res.json();
  const messages = (data.messages ?? []) as any[];

  return messages.map((msg) => {
    const headers = (msg.payload?.headers ?? []) as { name: string; value: string }[];
    return {
      id: msg.id as string,
      from: headerValue(headers, "From"),
      to: headerValue(headers, "To"),
      subject: headerValue(headers, "Subject"),
      date: headerValue(headers, "Date"),
      bodyText: extractPlainTextBody(msg.payload).trim(),
    };
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
