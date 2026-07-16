import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import type { ChatMessage } from "@/lib/chat/types";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

function mapMessage(row: Record<string, unknown>, namesByUser: Map<string, string>): ChatMessage {
  const userId = typeof row.user_id === "string" ? row.user_id : null;
  return {
    id: row.id as string,
    external_id: row.external_id as string | null,
    body: row.body as string | null,
    direction: row.direction as "inbound" | "outbound",
    created_at: row.created_at as string,
    status: row.status as string,
    media_url: row.media_url as string | null,
    media_type: row.media_type as string | null,
    reply_to_message_id: row.reply_to_message_id as string | null,
    reply_to_external_id: row.reply_to_external_id as string | null,
    reply_to_body: row.reply_to_body as string | null,
    reply_to_sender_name: row.reply_to_sender_name as string | null,
    user_id: userId,
    sender_name: userId ? (namesByUser.get(userId) ?? null) : null,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await requireContext();
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return json({ error: "conversationId ausente" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (conversationError) {
    return json({ error: conversationError.message }, { status: 500 });
  }
  if (!conversation) return json({ messages: [] });

  const { data, error } = await supabase
    .from("messages")
    .select("id, external_id, body, direction, created_at, status, media_url, media_type, reply_to_message_id, reply_to_external_id, reply_to_body, reply_to_sender_name, user_id")
    .eq("conversation_id", conversationId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((row) => row.user_id).filter(Boolean) as string[])];
  const namesByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const profile of profiles ?? []) {
      if (profile.full_name) namesByUser.set(profile.id, profile.full_name);
    }
  }

  return json({
    messages: (data ?? []).map((row) => mapMessage(row as Record<string, unknown>, namesByUser)),
  });
}
