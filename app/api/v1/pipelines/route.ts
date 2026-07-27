import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "pipelines:read");
    enforceRateLimit(ctx.apiKeyId);

    const supabase = createServiceClient();
    const [{ data: pipelines, error: pipelinesError }, { data: stages, error: stagesError }] = await Promise.all([
      supabase.from("pipelines").select("id, name, is_default").eq("tenant_id", ctx.tenantId).order("created_at"),
      supabase
        .from("pipeline_stages")
        .select("id, pipeline_id, name, position, color, is_won, is_lost")
        .eq("tenant_id", ctx.tenantId)
        .order("position"),
    ]);

    if (pipelinesError) throw new ApiError(500, "query_failed", pipelinesError.message);
    if (stagesError) throw new ApiError(500, "query_failed", stagesError.message);

    const data = (pipelines ?? []).map((pipeline) => ({
      ...pipeline,
      stages: (stages ?? []).filter((stage) => stage.pipeline_id === pipeline.id),
    }));

    return apiJson({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
