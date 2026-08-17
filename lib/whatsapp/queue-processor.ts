import type { SupabaseClient } from "@supabase/supabase-js";
import { toJson } from "@/lib/utils";

export interface EnqueueWebhookParams {
  tenantId?: string | null;
  whatsappAccountId?: string | null;
  provider: string;
  payload: unknown;
  maxRetries?: number;
}

export interface QueueItemResult {
  queueId: string;
  status: "completed" | "failed" | "dead_letter";
  error?: string;
}

/**
 * Insere um evento de webhook na fila de processamento assíncrono (Buffer).
 */
export async function enqueueWebhookEvent(
  supabase: SupabaseClient,
  params: EnqueueWebhookParams
): Promise<string | null> {
  const { tenantId = null, whatsappAccountId = null, provider, payload, maxRetries = 3 } = params;

  try {
    const { data, error } = await supabase
      .from("whatsapp_webhook_queue")
      .insert({
        tenant_id: tenantId,
        whatsapp_account_id: whatsappAccountId,
        provider,
        payload: toJson(payload),
        status: "pending",
        max_retries: maxRetries,
        retry_count: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[queue] Erro ao enfileirar webhook:", error.message);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error("[queue] Exceção ao enfileirar webhook:", err);
    return null;
  }
}

/**
 * Processa um item da fila com tolerância a falhas, retries e Dead Letter Queue.
 */
export async function processQueueItem(
  supabase: SupabaseClient,
  queueId: string,
  handler: () => Promise<void>
): Promise<QueueItemResult> {
  try {
    // 1. Marca como em processamento
    await supabase
      .from("whatsapp_webhook_queue")
      .update({ status: "processing" })
      .eq("id", queueId);

    // 2. Executa a função de processamento
    await handler();

    // 3. Sucesso: marca como completed
    await supabase
      .from("whatsapp_webhook_queue")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", queueId);

    return { queueId, status: "completed" };
  } catch (err) {
    const errorMessage = (err as Error).message || String(err);
    console.error(`[queue] Falha ao processar item ${queueId}:`, errorMessage);

    // 4. Busca contagem atual de retries
    const { data: item } = await supabase
      .from("whatsapp_webhook_queue")
      .select("retry_count, max_retries")
      .eq("id", queueId)
      .maybeSingle();

    const currentRetries = (item?.retry_count ?? 0) + 1;
    const maxRetries = item?.max_retries ?? 3;
    const isDeadLetter = currentRetries >= maxRetries;

    await supabase
      .from("whatsapp_webhook_queue")
      .update({
        status: isDeadLetter ? "dead_letter" : "failed",
        retry_count: currentRetries,
        last_error: errorMessage,
      })
      .eq("id", queueId);

    return {
      queueId,
      status: isDeadLetter ? "dead_letter" : "failed",
      error: errorMessage,
    };
  }
}
