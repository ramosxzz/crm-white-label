import { NextResponse } from "next/server";
import { listConversationItemsForTenant, getBlockedWhatsappAccountIds } from "@/lib/chat/list-conversation-items";
import { fetchLeadCallCountsForTenant } from "@/lib/integrations/call-counts";
import { requireContext } from "@/lib/tenant";

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

export async function GET(request: Request) {
  try {
    const ctx = await requireContext();
    const url = new URL(request.url);
    const search = url.searchParams.get("q");
    const status = url.searchParams.get("status");
    const hasSearch = Boolean(search?.trim());
    const blockedAccountIds = await getBlockedWhatsappAccountIds(ctx.tenantId, ctx.userId, ctx.role);
    const conversations = await listConversationItemsForTenant(
      ctx.tenantId,
      hasSearch ? 200 : 300,
      { search, status },
      ctx.tenant.name,
      blockedAccountIds,
    );
    const callCounts = await fetchLeadCallCountsForTenant(ctx.tenantId, {
      includeApi4com: ctx.tenant.calls_dashboard_enabled,
    });
    return json({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        callCount: callCounts[conversation.leadId] ?? 0,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar conversas";
    return json({ error: message }, { status: 500 });
  }
}
