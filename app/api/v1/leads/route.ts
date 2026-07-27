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

const LIST_PAGE_SIZE = 50;

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "leads:read");
    enforceRateLimit(ctx.apiKeyId);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const stageId = url.searchParams.get("stage_id");
    const pipelineId = url.searchParams.get("pipeline_id");
    const source = url.searchParams.get("source");
    const createdAfter = url.searchParams.get("created_after");

    const supabase = createServiceClient();
    let query = supabase
      .from("leads")
      .select(
        "id, name, phone, email, source, notes, tags, stage_id, pipeline_id, value_cents, quality_stars, created_at, updated_at",
        { count: "exact" },
      )
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false });

    if (stageId) query = query.eq("stage_id", stageId);
    if (pipelineId) query = query.eq("pipeline_id", pipelineId);
    if (source) query = query.eq("source", source);
    if (createdAfter) query = query.gte("created_at", createdAfter);

    const from = (page - 1) * LIST_PAGE_SIZE;
    const to = from + LIST_PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) throw new ApiError(500, "query_failed", error.message);

    return apiJson({
      data: data ?? [],
      pagination: {
        page,
        page_size: LIST_PAGE_SIZE,
        total: count ?? 0,
        total_pages: Math.max(1, Math.ceil((count ?? 0) / LIST_PAGE_SIZE)),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const createLeadSchema = z.object({
  name: z.string().min(1, "name e obrigatorio"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  stage_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  value_cents: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "leads:write");
    enforceRateLimit(ctx.apiKeyId);

    const body = await req.json().catch(() => ({}));
    const parsed = createLeadSchema.parse(body);

    const supabase = createServiceClient();

    let stageId = parsed.stage_id;
    let pipelineId = parsed.pipeline_id;

    if (stageId && !pipelineId) {
      const { data: stageRow } = await supabase
        .from("pipeline_stages")
        .select("pipeline_id")
        .eq("id", stageId)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (!stageRow) throw new ApiError(400, "invalid_stage_id", "stage_id nao encontrado neste tenant");
      pipelineId = stageRow.pipeline_id;
    }

    if (!stageId) {
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id, pipeline_stages(id, position)")
        .eq("tenant_id", ctx.tenantId)
        .eq("is_default", true)
        .maybeSingle();
      const stages = (pipeline as { id?: string; pipeline_stages?: { id: string; position: number }[] } | null)
        ?.pipeline_stages?.sort((a, b) => a.position - b.position);
      stageId = stages?.[0]?.id;
      pipelineId = (pipeline as { id?: string } | null)?.id;
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        tenant_id: ctx.tenantId,
        name: parsed.name,
        phone: parsed.phone ? normalizePhone(parsed.phone) : null,
        email: parsed.email ?? null,
        source: parsed.source ?? null,
        notes: parsed.notes ?? null,
        stage_id: stageId ?? null,
        pipeline_id: pipelineId ?? null,
        value_cents: parsed.value_cents ?? 0,
        tags: parsed.tags ?? [],
      })
      .select("id, name, phone, email, source, notes, tags, stage_id, pipeline_id, value_cents, created_at")
      .single();

    if (error) throw new ApiError(500, "insert_failed", error.message);

    void fireAutomationTrigger(ctx.tenantId, "lead_created", lead.id, { source: parsed.source ?? null });
    void dispatchWebhookEvent(ctx.tenantId, "lead.created", {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      source: lead.source,
    });

    return apiJson({ data: lead }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}
