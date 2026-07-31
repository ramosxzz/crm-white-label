import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";
import { sendChatMessageCore } from "@/lib/chat/send-message-core";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "messages:read");
    enforceRateLimit(ctx.apiKeyId);

    const url = new URL(req.url);
    const leadId = url.searchParams.get("leadId");
    if (!leadId) throw new ApiError(400, "missing_lead_id", "Parametro leadId e obrigatorio");

    const supabase = createServiceClient();
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("lead_id", leadId)
      .eq("channel", "whatsapp")
      .maybeSingle();

    if (!conversation) return apiJson({ data: [] });

    const { data, error } = await supabase
      .from("messages")
      .select("id, external_id, body, direction, created_at, status, media_url, media_type, edited_at, deleted_at")
      .eq("conversation_id", conversation.id)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new ApiError(500, "query_failed", error.message);

    return apiJson({ data: (data ?? []).reverse() });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const sendMessageSchema = z.object({
  leadId: z.string().uuid(),
  body: z.string().min(1, "body e obrigatorio"),
  accountId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "messages:write");
    enforceRateLimit(ctx.apiKeyId);

    const payload = sendMessageSchema.parse(await req.json().catch(() => ({})));
    const supabase = createServiceClient();

    let result;
    try {
      result = await sendChatMessageCore(supabase, {
        tenantId: ctx.tenantId,
        userId: null,
        leadId: payload.leadId,
        body: payload.body,
        accountId: payload.accountId,
      });
    } catch (sendError) {
      throw new ApiError(400, "send_failed", (sendError as Error).message);
    }

    return apiJson({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}
