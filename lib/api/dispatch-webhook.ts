import { createHmac } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type { WebhookEvent } from "@/lib/api/webhook-events";

export type { WebhookEvent };

const DISPATCH_TIMEOUT_MS = 8_000;

function sign(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Notifica sistemas externos que assinaram um evento via /integrations/api ou
 * pela API publica. Fire-and-forget (nao bloqueia quem chamou), sem fila de
 * retry na v1 - uma tentativa, log da entrega em api_webhook_deliveries.
 */
export async function dispatchWebhookEvent(
  tenantId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: webhooks } = await supabase
      .from("api_webhooks")
      .select("id, url, secret")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (!webhooks || webhooks.length === 0) return;

    const body = JSON.stringify({ event, tenant_id: tenantId, data: payload, sent_at: new Date().toISOString() });

    await Promise.all(
      webhooks.map(async (webhook) => {
        let statusCode: number | null = null;
        let responseBody: string | null = null;
        let errorMessage: string | null = null;
        try {
          const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Solaire-Event": event,
              "X-Solaire-Signature": sign(webhook.secret, body),
            },
            body,
            signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
          });
          statusCode = res.status;
          responseBody = (await res.text().catch(() => "")).slice(0, 500);
        } catch (err) {
          errorMessage = (err as Error).message;
        }
        await supabase.from("api_webhook_deliveries").insert({
          webhook_id: webhook.id,
          tenant_id: tenantId,
          event,
          status_code: statusCode,
          response_body: responseBody,
          error: errorMessage,
        });
      }),
    );
  } catch (err) {
    console.error("dispatchWebhookEvent failed", err);
  }
}
