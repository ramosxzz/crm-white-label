import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";
import { fireAutomationTrigger, type TriggerKind } from "@/lib/automations/trigger";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

const TRIGGER_KINDS: TriggerKind[] = [
  "lead_created",
  "stage_changed",
  "message_received",
  "message_sent",
  "appointment_created",
  "appointment_near",
  "lead_inactive",
];

const triggerSchema = z.object({
  leadId: z.string().uuid(),
  kind: z.enum(TRIGGER_KINDS as [TriggerKind, ...TriggerKind[]]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "automations:trigger");
    enforceRateLimit(ctx.apiKeyId);

    const parsed = triggerSchema.parse(await req.json().catch(() => ({})));

    const supabase = createServiceClient();
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", parsed.leadId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!lead) throw new ApiError(404, "not_found", "Lead nao encontrado neste tenant");

    await fireAutomationTrigger(ctx.tenantId, parsed.kind, parsed.leadId, parsed.payload ?? {});

    return apiJson({ data: { ok: true } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}
