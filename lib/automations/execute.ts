import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import type { WhatsAppAccount } from "@/lib/supabase/database.types";

type Block = {
  id: string;
  type: string;
  data: {
    kind?: string;
    config?: Record<string, unknown>;
  };
};

type Connection = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

type FlowConfig = {
  blocks: Block[];
  connections: Connection[];
};

function findNextBlocks(
  blockId: string,
  connections: Connection[],
  blocks: Block[],
  handle?: string,
): Block[] {
  return connections
    .filter((c) => c.source === blockId && (!handle || c.sourceHandle === handle))
    .map((c) => blocks.find((b) => b.id === c.target))
    .filter(Boolean) as Block[];
}

function interpolate(template: string, lead: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(lead[key] ?? ""));
}

export async function processExecution(
  supabase: SupabaseClient,
  executionId: string,
): Promise<void> {
  const { data: execution } = await supabase
    .from("automation_executions")
    .select("*, automation_versions(config)")
    .eq("id", executionId)
    .single();

  if (!execution || execution.status !== "running") return;

  const config = (execution.automation_versions as { config: FlowConfig } | null)?.config;
  if (!config) return;

  const { blocks, connections } = config;
  const tenantId = execution.tenant_id as string;
  const leadId = execution.lead_id as string | null;

  // Fetch lead data for interpolation
  let lead: Record<string, unknown> = {};
  if (leadId) {
    const { data: leadRow } = await supabase.from("leads").select("*").eq("id", leadId).single();
    if (leadRow) lead = leadRow as Record<string, unknown>;
  }

  // Find the trigger block (starting point)
  const triggerBlock = blocks.find((b) => b.type === "trigger");
  if (!triggerBlock) {
    await supabase
      .from("automation_executions")
      .update({ status: "failed", error_message: "No trigger block", finished_at: new Date().toISOString() })
      .eq("id", executionId);
    return;
  }

  // BFS walk the flow
  const visited = new Set<string>();
  const queue: Block[] = findNextBlocks(triggerBlock.id, connections, blocks);

  while (queue.length > 0) {
    const block = queue.shift()!;
    if (visited.has(block.id)) continue;
    visited.add(block.id);

    const kind = block.data.kind ?? block.type;
    const blockConfig = block.data.config ?? {};

    // Record the step
    const { data: step } = await supabase
      .from("automation_execution_steps")
      .insert({
        execution_id: executionId,
        tenant_id: tenantId,
        block_id: block.id,
        block_type: kind,
        status: "running",
        input_payload: { lead_id: leadId, config: blockConfig },
      })
      .select("id")
      .single();

    try {
      let result: Record<string, unknown> = {};

      if (kind === "send_message" && leadId) {
        const message = interpolate(String(blockConfig.message ?? ""), lead);
        const leadPhone = String(lead.phone ?? "");

        // Localiza ou cria a conversa de WhatsApp
        const { data: account } = await supabase
          .from("whatsapp_accounts")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        let convId: string | undefined;
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("lead_id", leadId)
          .eq("channel", "whatsapp")
          .maybeSingle();
        if (conv) {
          convId = (conv as { id: string }).id;
        } else {
          const { data: createdConv } = await supabase
            .from("conversations")
            .insert({
              tenant_id: tenantId,
              lead_id: leadId,
              whatsapp_account_id: (account as { id?: string } | null)?.id ?? null,
              channel: "whatsapp",
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          convId = (createdConv as { id: string } | null)?.id;
        }

        // Insere a mensagem pendente
        const { data: pending } = convId
          ? await supabase
              .from("messages")
              .insert({
                tenant_id: tenantId,
                conversation_id: convId,
                direction: "outbound",
                body: message,
                status: "pending",
              })
              .select("id")
              .single()
          : { data: null };

        // Envia de fato pelo provedor
        const normalized = normalizeWhatsAppPhone(leadPhone) ?? leadPhone.replace(/\D/g, "");
        if (account && normalized && pending) {
          try {
            const provider = createProvider(account as unknown as WhatsAppAccount);
            const sendResult = await provider.send({ to: normalized, body: message });
            await supabase
              .from("messages")
              .update(
                sendResult.status === "sent"
                  ? { status: "sent", external_id: sendResult.externalId }
                  : { status: "failed", error: "Falha no envio pelo provedor" },
              )
              .eq("id", (pending as { id: string }).id);
            if (convId && sendResult.status === "sent") {
              await supabase
                .from("conversations")
                .update({ last_message_at: new Date().toISOString(), status: "em_atendimento" })
                .eq("id", convId);
            }
            result = { sent: sendResult.status === "sent", message };
          } catch (sendErr) {
            await supabase
              .from("messages")
              .update({ status: "failed", error: (sendErr as Error).message })
              .eq("id", (pending as { id: string }).id);
            result = { sent: false, error: (sendErr as Error).message };
          }
        } else {
          result = { message_queued: Boolean(convId), message, reason: !account ? "sem conta WhatsApp" : "sem telefone" };
        }
      } else if (kind === "move_stage" && leadId) {
        const stageId = String(blockConfig.stage_id ?? "");
        if (stageId) {
          await supabase
            .from("leads")
            .update({ stage_id: stageId })
            .eq("id", leadId)
            .eq("tenant_id", tenantId);
          result = { stage_id: stageId };
        }
      } else if (kind === "assign_lead" && leadId) {
        const userId = String(blockConfig.user_id ?? "");
        if (userId) {
          await supabase
            .from("leads")
            .update({ assigned_to: userId })
            .eq("id", leadId)
            .eq("tenant_id", tenantId);
          result = { assigned_to: userId };
        }
      } else if (kind === "create_task" && leadId) {
        const title = interpolate(String(blockConfig.title ?? "Tarefa automática"), lead);
        const dueDays = Number(blockConfig.due_days ?? 0);
        const dueAt = dueDays > 0
          ? new Date(Date.now() + dueDays * 86400000).toISOString()
          : null;
        await supabase.from("tasks").insert({
          tenant_id: tenantId,
          lead_id: leadId,
          title,
          due_at: dueAt,
          status: "open",
        });
        result = { task_created: true };
      } else if (kind === "add_tag" && leadId) {
        const tag = String(blockConfig.tag ?? "");
        if (tag) {
          const { data: currentLead } = await supabase
            .from("leads")
            .select("tags")
            .eq("id", leadId)
            .single();
          const tags = (currentLead as { tags?: string[] } | null)?.tags ?? [];
          if (!tags.includes(tag)) {
            await supabase
              .from("leads")
              .update({ tags: [...tags, tag] })
              .eq("id", leadId)
              .eq("tenant_id", tenantId);
          }
          result = { tag_added: tag };
        }
      } else if (kind === "log_activity" && leadId) {
        const message = interpolate(String(blockConfig.message ?? "Acao automatica"), lead);
        await supabase.from("lead_activities").insert({
          tenant_id: tenantId,
          lead_id: leadId,
          kind: "automation",
          payload: { message },
        });
        result = { logged: true };
      } else if (kind === "field_ops" && leadId) {
        const field = String(blockConfig.field ?? "");
        const value = interpolate(String(blockConfig.value ?? ""), lead);
        const ALLOWED = ["name", "email", "phone", "source", "value", "notes", "stage_id", "assigned_to"];
        if (field && ALLOWED.includes(field)) {
          await supabase
            .from("leads")
            .update({ [field]: value })
            .eq("id", leadId)
            .eq("tenant_id", tenantId);
          lead[field] = value;
          result = { field, value };
        } else {
          result = { skipped: `campo "${field}" não permitido` };
        }
      } else if (kind === "api_call") {
        const url = interpolate(String(blockConfig.url ?? ""), lead);
        const method = String(blockConfig.method ?? "POST").toUpperCase();
        const bodyTemplate = String(blockConfig.body ?? "");
        const body = bodyTemplate ? interpolate(bodyTemplate, lead) : undefined;
        if (!url) {
          result = { skipped: "URL ausente" };
        } else {
          const resp = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            ...(method !== "GET" && body ? { body } : {}),
          });
          let responseText = "";
          try {
            responseText = (await resp.text()).slice(0, 500);
          } catch {
            /* ignore */
          }
          result = { api_status: resp.status, ok: resp.ok, response: responseText };
        }
      } else if (kind === "randomizer") {
        // Escolhe aleatoriamente um dos caminhos de saída (teste A/B)
        const nexts = findNextBlocks(block.id, connections, blocks);
        if (nexts.length > 0) {
          const chosen = nexts[Math.floor(Math.random() * nexts.length)];
          if (!visited.has(chosen.id)) queue.push(chosen);
        }
        if (step) {
          await supabase
            .from("automation_execution_steps")
            .update({ status: "done", result_payload: { branches: nexts.length } })
            .eq("id", step.id);
        }
        continue;
      } else if (kind === "ai") {
        // Compatível com OpenAI Chat Completions (NVIDIA NIM, OpenAI, Groq, OpenRouter, Gemini...)
        const apiKey = process.env.AI_API_KEY;
        const baseUrl = (process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
        const model = String(blockConfig.model ?? process.env.AI_MODEL ?? "meta/llama-3.3-70b-instruct");
        const prompt = interpolate(String(blockConfig.prompt ?? ""), lead);
        if (!apiKey) {
          result = { skipped: "AI_API_KEY não configurada" };
        } else if (!prompt) {
          result = { skipped: "prompt vazio" };
        } else {
          const resp = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "user",
                  content: `${prompt}\n\nDados do lead (JSON): ${JSON.stringify(lead)}`,
                },
              ],
              temperature: 0.2,
              max_tokens: 512,
            }),
          });
          const data = (await resp.json()) as {
            choices?: { message?: { content?: string } }[];
            error?: { message?: string } | string;
          };
          const textOut = data?.choices?.[0]?.message?.content ?? "";
          if (leadId && textOut) {
            await supabase.from("lead_activities").insert({
              tenant_id: tenantId,
              lead_id: leadId,
              kind: "automation",
              payload: { ai: textOut },
            });
          }
          const errMsg = typeof data?.error === "string" ? data.error : data?.error?.message;
          result = { ai_response: textOut.slice(0, 500), error: errMsg };
        }
      } else if (kind === "javascript") {
        const code = String(blockConfig.code ?? "");
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function("lead", code);
          const out = fn({ ...lead });
          result = { js_result: typeof out === "object" ? JSON.stringify(out) : String(out) };
        } catch (jsErr) {
          result = { js_error: (jsErr as Error).message };
        }
      } else if (kind === "wait") {
        const minutes = Number(blockConfig.minutes ?? 60);
        const resumeAt = new Date(Date.now() + minutes * 60000).toISOString();
        if (step) {
          await supabase
            .from("automation_execution_steps")
            .update({ status: "waiting", resume_at: resumeAt })
            .eq("id", step.id);
        }
        // Stop processing this branch until resumed
        continue;
      } else if (kind === "condition" && leadId) {
        const field = String(blockConfig.field ?? "");
        const operator = String(blockConfig.operator ?? "eq");
        const value = blockConfig.value;
        const leadValue = lead[field];

        let conditionMet = false;
        if (operator === "eq") conditionMet = leadValue === value;
        else if (operator === "neq") conditionMet = leadValue !== value;
        else if (operator === "contains") conditionMet = String(leadValue).includes(String(value));
        else if (operator === "gt") conditionMet = Number(leadValue) > Number(value);
        else if (operator === "lt") conditionMet = Number(leadValue) < Number(value);

        // Follow "yes" or "no" handle
        const nextHandle = conditionMet ? "yes" : "no";
        const nextBlocks = findNextBlocks(block.id, connections, blocks, nextHandle);
        queue.push(...nextBlocks.filter((b) => !visited.has(b.id)));

        if (step) {
          await supabase
            .from("automation_execution_steps")
            .update({ status: "done", result_payload: { condition_met: conditionMet } })
            .eq("id", step.id);
        }
        continue;
      }

      if (step) {
        await supabase
          .from("automation_execution_steps")
          .update({ status: "done", result_payload: result })
          .eq("id", step.id);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (step) {
        await supabase
          .from("automation_execution_steps")
          .update({ status: "failed", error: errorMsg })
          .eq("id", step.id);
      }
      await supabase
        .from("automation_executions")
        .update({ status: "failed", error_message: errorMsg, finished_at: new Date().toISOString() })
        .eq("id", executionId);
      return;
    }

    // Queue next blocks
    const nextBlocks = findNextBlocks(block.id, connections, blocks);
    queue.push(...nextBlocks.filter((b) => !visited.has(b.id)));
  }

  await supabase
    .from("automation_executions")
    .update({ status: "completed", finished_at: new Date().toISOString() })
    .eq("id", executionId);
}
