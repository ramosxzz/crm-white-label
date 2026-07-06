import { NextResponse } from "next/server";
import { listConversationItemsForTenant } from "@/lib/chat/list-conversation-items";
import { requireContext } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const ctx = await requireContext();
    const url = new URL(request.url);
    const search = url.searchParams.get("q");
    const status = url.searchParams.get("status");
    const hasSearch = Boolean(search?.trim());
    const conversations = await listConversationItemsForTenant(
      ctx.tenantId,
      hasSearch ? 200 : 100,
      { search, status },
      ctx.tenant.name,
    );
    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar conversas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
