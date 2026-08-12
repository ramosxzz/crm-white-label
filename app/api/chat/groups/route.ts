import { NextResponse } from "next/server";
import { listWhatsAppGroupItemsForTenant } from "@/lib/chat/list-group-items";
import { getChatAccountVisibility } from "@/lib/chat/list-conversation-items";
import { requireContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireContext();
  try {
    const visibility = await getChatAccountVisibility(ctx.tenantId, ctx.userId, ctx.role);
    const groups = await listWhatsAppGroupItemsForTenant(ctx.tenantId, visibility);
    return NextResponse.json({ groups });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar grupos" },
      { status: 500 },
    );
  }
}
