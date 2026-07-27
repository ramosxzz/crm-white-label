import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { dispatchWebhookEvent } from "@/lib/api/dispatch-webhook";
import { normalizePhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

const LEAD_SELECT =
  "id, name, phone, email, source, notes, tags, stage_id, pipeline_id, value_cents, quality_stars, created_at, updated_at";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "leads:read");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const supabase = createServiceClient();
    const { data: lead, error } = await supabase
      .from("leads")
      .select(LEAD_SELECT)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (error) throw new ApiError(500, "query_failed", error.message);
    if (!lead) throw new ApiError(404, "not_found", "Lead nao encontrado");

    return apiJson({ data: lead });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  stage_id: z.string().uuid().optional(),
  value_cents: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "leads:write");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = updateLeadSchema.parse(body);

    const supabase = createServiceClient();
    const patch: Record<string, unknown> = { ...parsed };
    if (parsed.phone) patch.phone = normalizePhone(parsed.phone);

    if (parsed.stage_id) {
      const { data: stageRow } = await supabase
        .from("pipeline_stages")
        .select("pipeline_id")
        .eq("id", parsed.stage_id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (!stageRow) throw new ApiError(400, "invalid_stage_id", "stage_id nao encontrado neste tenant");
      patch.pipeline_id = stageRow.pipeline_id;
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .select(LEAD_SELECT)
      .maybeSingle();

    if (error) throw new ApiError(500, "update_failed", error.message);
    if (!lead) throw new ApiError(404, "not_found", "Lead nao encontrado");

    if (parsed.stage_id) {
      void fireAutomationTrigger(ctx.tenantId, "stage_changed", id, { stage_id: parsed.stage_id });
      void dispatchWebhookEvent(ctx.tenantId, "lead.stage_changed", { id, stage_id: parsed.stage_id });
    }

    return apiJson({ data: lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "leads:write");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const supabase = createServiceClient();
    const { error } = await supabase.from("leads").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
    if (error) throw new ApiError(500, "delete_failed", error.message);

    return apiJson({ data: { id, deleted: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
