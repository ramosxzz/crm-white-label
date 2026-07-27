import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireApiKeyContext, requireScope, ApiError } from "@/lib/api/auth";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { apiJson, apiErrorResponse, CORS_HEADERS } from "@/lib/api/response";
import type { WebhookEvent } from "@/lib/api/webhook-events";

export const dynamic = "force-dynamic";

const WEBHOOK_EVENTS: WebhookEvent[] = ["lead.created", "lead.stage_changed", "message.received"];

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "webhooks:manage");
    enforceRateLimit(ctx.apiKeyId);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("api_webhooks")
      .select("id, url, events, is_active, created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false });
    if (error) throw new ApiError(500, "query_failed", error.message);

    return apiJson({ data: data ?? [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS as [WebhookEvent, ...WebhookEvent[]])).min(1),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiKeyContext(req);
    requireScope(ctx, "webhooks:manage");
    enforceRateLimit(ctx.apiKeyId);

    const parsed = createWebhookSchema.parse(await req.json().catch(() => ({})));
    const secret = randomBytes(24).toString("hex");

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("api_webhooks")
      .insert({ tenant_id: ctx.tenantId, url: parsed.url, events: parsed.events, secret })
      .select("id, url, events, is_active, created_at")
      .single();
    if (error) throw new ApiError(500, "insert_failed", error.message);

    // Segredo (pra validar a assinatura HMAC) so aparece aqui, na criacao.
    return apiJson({ data: { ...data, secret } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiErrorResponse(new ApiError(400, "validation_error", error.issues[0]?.message ?? "Dados invalidos"));
    }
    return apiErrorResponse(error);
  }
}
