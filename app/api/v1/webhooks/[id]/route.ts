import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "webhooks:manage");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const supabase = createServiceClient();
    const { error } = await supabase.from("api_webhooks").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new ApiError(500, "delete_failed", error.message);

    return apiJson({ data: { id, deleted: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
