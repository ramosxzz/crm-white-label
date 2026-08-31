import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";
import { dispatchWebhookEvent } from "@/lib/api/dispatch-webhook";
import type { Database } from "@/lib/supabase/database.types";
import { AGENDA_SELECT_WITH_NAMES, withAssigneeNames, type AgendaRow } from "@/lib/api/agenda-enrich";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "agenda:read");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const supabase = createServiceClient();
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select(AGENDA_SELECT_WITH_NAMES)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (error) throw new ApiError(500, "query_failed", error.message);
    if (!appointment) throw new ApiError(404, "not_found", "Compromisso nao encontrado");

    const [enriched] = await withAssigneeNames(supabase, ctx.tenantId, [appointment as unknown as AgendaRow]);

    return apiJson({ data: enriched });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const updateAppointmentSchema = z.object({
  starts_at: z.string().min(1).optional(),
  duration_minutes: z.number().int().positive().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  professional_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "agenda:write");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = updateAppointmentSchema.parse(body);

    const supabase = createServiceClient();
    const patch: Database["public"]["Tables"]["appointments"]["Update"] = { ...parsed };
    if (parsed.starts_at) {
      const startsAtIso = new Date(parsed.starts_at).toISOString();
      if (Number.isNaN(new Date(startsAtIso).getTime())) {
        throw new ApiError(400, "invalid_starts_at", "starts_at precisa ser uma data valida");
      }
      patch.starts_at = startsAtIso;
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .select(AGENDA_SELECT_WITH_NAMES)
      .maybeSingle();

    if (error) throw new ApiError(500, "update_failed", error.message);
    if (!appointment) throw new ApiError(404, "not_found", "Compromisso nao encontrado");

    const [enriched] = await withAssigneeNames(supabase, ctx.tenantId, [appointment as unknown as AgendaRow]);

    void dispatchWebhookEvent(ctx.tenantId, "appointment.updated", {
      id: appointment.id,
      lead_id: appointment.lead_id,
      lead_name: enriched.lead_name,
      starts_at: appointment.starts_at,
      status: appointment.status,
    });

    return apiJson({ data: enriched });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}

/** Cancela em vez de apagar - mesma regra da tela (mantem o historico do
 * compromisso em vez de sumir com o registro). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "agenda:write");
    enforceRateLimit(ctx.apiKeyId);
    const { id } = await params;

    const supabase = createServiceClient();
    const { data: appointment, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .select(AGENDA_SELECT_WITH_NAMES)
      .maybeSingle();

    if (error) throw new ApiError(500, "update_failed", error.message);
    if (!appointment) throw new ApiError(404, "not_found", "Compromisso nao encontrado");

    const [enriched] = await withAssigneeNames(supabase, ctx.tenantId, [appointment as unknown as AgendaRow]);

    void dispatchWebhookEvent(ctx.tenantId, "appointment.cancelled", { id: appointment.id, lead_id: appointment.lead_id });

    return apiJson({ data: enriched });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
