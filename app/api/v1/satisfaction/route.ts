import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

// Google Forms manda string ou array de strings (se a pergunta virar checkbox
// de multipla escolha em vez de radio) - aceita os dois e normaliza pra string.
const employeeNameField = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => (Array.isArray(v) ? v.join(", ") : v)?.trim().slice(0, 200));

const createSurveyResponseSchema = z.object({
  employee_name: employeeNameField,
  service_rating: z.coerce.number().int().min(1).max(5).optional(),
  nps_score: z.coerce.number().int().min(0).max(10),
  comments: z.string().trim().max(4000).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "survey:write");
    enforceRateLimit(ctx.apiKeyId);

    const body = await req.json().catch(() => ({}));
    const parsed = createSurveyResponseSchema.parse(body);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("satisfaction_survey_responses")
      .insert({
        tenant_id: ctx.tenantId,
        employee_name: parsed.employee_name || null,
        service_rating: parsed.service_rating ?? null,
        nps_score: parsed.nps_score,
        comments: parsed.comments || null,
      })
      .select("id, employee_name, service_rating, nps_score, comments, created_at")
      .single();

    if (error) throw new ApiError(500, "insert_failed", error.message);

    return apiJson({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}
