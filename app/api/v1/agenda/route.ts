import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";
import { fireAutomationTrigger } from "@/lib/automations/trigger";
import { dispatchWebhookEvent } from "@/lib/api/dispatch-webhook";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

const LIST_PAGE_SIZE = 50;

const AGENDA_SELECT =
  "id, lead_id, assigned_to, professional_id, service_id, starts_at, duration_minutes, notes, kind, status, created_at, updated_at";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "agenda:read");
    enforceRateLimit(ctx.apiKeyId);

    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const leadId = url.searchParams.get("lead_id");
    const assignedTo = url.searchParams.get("assigned_to");
    const status = url.searchParams.get("status");
    const startsAfter = url.searchParams.get("starts_after");
    const startsBefore = url.searchParams.get("starts_before");

    const supabase = createServiceClient();
    let query = supabase
      .from("appointments")
      .select(AGENDA_SELECT, { count: "exact" })
      .eq("tenant_id", ctx.tenantId)
      .order("starts_at", { ascending: true });

    if (leadId) query = query.eq("lead_id", leadId);
    if (assignedTo) query = query.eq("assigned_to", assignedTo);
    if (status) query = query.eq("status", status);
    if (startsAfter) query = query.gte("starts_at", startsAfter);
    if (startsBefore) query = query.lte("starts_at", startsBefore);

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

const createAppointmentSchema = z.object({
  lead_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  professional_id: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  starts_at: z.string().min(1, "starts_at e obrigatorio"),
  duration_minutes: z.number().int().positive().default(60),
  notes: z.string().optional(),
  kind: z.enum(["meeting", "call", "internal"]).default("meeting"),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "agenda:write");
    enforceRateLimit(ctx.apiKeyId);

    const body = await req.json().catch(() => ({}));
    const parsed = createAppointmentSchema.parse(body);

    const startsAtIso = new Date(parsed.starts_at).toISOString();
    if (Number.isNaN(new Date(startsAtIso).getTime())) {
      throw new ApiError(400, "invalid_starts_at", "starts_at precisa ser uma data valida");
    }

    const supabase = createServiceClient();

    // Alinhamento interno nunca amarra a um lead - mesma regra da tela.
    const leadId = parsed.kind === "internal" ? null : (parsed.lead_id ?? null);
    if (leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .eq("id", leadId)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (!lead) throw new ApiError(400, "invalid_lead_id", "lead_id nao encontrado neste tenant");
    }

    if (parsed.assigned_to) {
      const { data: member } = await supabase
        .from("tenant_members")
        .select("user_id")
        .eq("tenant_id", ctx.tenantId)
        .eq("user_id", parsed.assigned_to)
        .maybeSingle();
      if (!member) throw new ApiError(400, "invalid_assigned_to", "assigned_to nao pertence a este workspace");
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        tenant_id: ctx.tenantId,
        lead_id: leadId,
        assigned_to: parsed.assigned_to ?? null,
        professional_id: parsed.professional_id ?? null,
        service_id: parsed.service_id ?? null,
        starts_at: startsAtIso,
        duration_minutes: parsed.duration_minutes,
        notes: parsed.notes?.trim() || null,
        kind: parsed.kind,
      })
      .select(AGENDA_SELECT)
      .single();

    if (error) throw new ApiError(500, "insert_failed", error.message);

    if (leadId) {
      void fireAutomationTrigger(ctx.tenantId, "appointment_created", leadId, { appointment_id: appointment.id });
    }
    void dispatchWebhookEvent(ctx.tenantId, "appointment.created", {
      id: appointment.id,
      lead_id: appointment.lead_id,
      starts_at: appointment.starts_at,
      kind: appointment.kind,
    });

    return apiJson({ data: appointment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}
