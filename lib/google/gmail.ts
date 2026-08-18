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
