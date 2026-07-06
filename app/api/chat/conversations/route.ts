import { NextResponse } from "next/server";
import { listConversationItemsForTenant } from "@/lib/chat/list-conversation-items";
import { requireContext } from "@/lib/tenant";

export async function GET() {
  try {
    const ctx = await requireContext();
    const conversations = await listConversationItemsForTenant(ctx.tenantId);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar conversas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
