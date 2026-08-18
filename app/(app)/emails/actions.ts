"use server";

import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import {
  getValidAccessToken,
  listInboxThreads,
  getGmailThread,
  sendGmailReply,
  type InboxThreadSummary,
  type GmailFullMessage,
} from "@/lib/google/gmail";

type ActionError = { ok: false; error: string };

async function accessTokenOrError(): Promise<{ ok: true; accessToken: string } | ActionError> {
  const ctx = await requireContext();
  const supabase = await createClient();
  const account = await getValidAccessToken(supabase, ctx.tenantId);
  if (!account) return { ok: false, error: "Nenhuma conta do Gmail conectada." };
  return { ok: true, accessToken: account.accessToken };
}

export async function listInboxAction(): Promise<
  { ok: true; threads: InboxThreadSummary[] } | ActionError
> {
  const token = await accessTokenOrError();
  if (!token.ok) return token;
  try {
    const threads = await listInboxThreads(token.accessToken);
    return { ok: true, threads };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getThreadAction(
  threadId: string,
): Promise<{ ok: true; messages: GmailFullMessage[] } | ActionError> {
  const token = await accessTokenOrError();
  if (!token.ok) return token;
  try {
    const messages = await getGmailThread(token.accessToken, threadId);
    return { ok: true, messages };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function sendReplyAction(input: {
  threadId: string;
  to: string;
  subject: string;
  inReplyTo: string;
  body: string;
}): Promise<{ ok: true } | ActionError> {
  if (!input.body.trim()) return { ok: false, error: "Escreva uma mensagem." };
  const token = await accessTokenOrError();
  if (!token.ok) return token;
  try {
    await sendGmailReply(token.accessToken, input);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
