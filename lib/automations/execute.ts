import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/whatsapp/factory";
import { triggerApi4comCall } from "@/lib/integrations/api4com";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { getWhatsAppAccountForLead } from "@/lib/whatsapp/account-for-lead";
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

type ActionCtx = {
  supabase: SupabaseClient;
  tenantId: string;
  leadId: string | null;
  lead: Record<string, unknown>;
  executionId: string;
};

/** Executa uma unica acao atomica (usado tanto por blocos legados de kind
 * unico quanto por cada item dentro de um bloco "Acao" com varias sub-acoes). */
async function runAction(
  kind: string,
  blockConfig: Record<string, unknown>,
  ctx: ActionCtx,
): Promise<Record<string, unknown>> {
  const { supabase, tenantId, leadId, lead, executionId } = ctx;

  if (kind === "send_message" && leadId) {
    const message = interpolate(String(blockConfig.message ?? ""), lead);
    const leadPhone = String(lead.phone ?? "");

    // Usa a conta do lead (mesmo numero que ele falou), nao a primeira ativa.
    const account = await getWhatsAppAccountForLead(supabase, tenantId, leadId);

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
        return { sent: sendResult.status === "sent", message };
      } catch (sendErr) {
        await supabase
          .from("messages")
          .update({ status: "failed", error: (sendErr as Error).message })
          .eq("id", (pending as { id: string }).id);
        return { sent: false, error: (sendErr as Error).message };
      }
    }
    return { message_queued: Boolean(convId), message, reason: !account ? "sem conta WhatsApp" : "sem telefone" };
  }

  if (kind === "move_stage" && leadId) {
    const stageId = String(blockConfig.stage_id ?? "");
    if (stageId) {
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("pipeline_id")
        .eq("id", stageId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      await supabase
        .from("leads")
        .update({ stage_id: stageId, pipeline_id: stage?.pipeline_id ?? null })
        .eq("id", leadId)
        .eq("tenant_id", tenantId);
      lead.stage_id = stageId;
      lead.pipeline_id = stage?.pipeline_id ?? null;
      return { stage_id: stageId, pipeline_id: stage?.pipeline_id ?? null };
    }
    return { skipped: "etapa nao informada" };
  }

  if (kind === "assign_lead" && leadId) {
    const userId = String(blockConfig.user_id ?? "");
    if (userId) {
      await supabase.from("leads").update({ assigned_to: userId }).eq("id", leadId).eq("tenant_id", tenantId);
      lead.assigned_to = userId;
      return { assigned_to: userId };
    }
    return { skipped: "responsavel nao informado" };
  }

  if (kind === "create_task" && leadId) {
    const title = interpolate(String(blockConfig.title ?? "Tarefa automática"), lead);
    const dueDays = Number(blockConfig.due_days ?? 0);
    const dueAt = dueDays > 0 ? new Date(Date.now() + dueDays * 86400000).toISOString() : null;
    await supabase.from("tasks").insert({ tenant_id: tenantId, lead_id: leadId, title, due_at: dueAt, status: "open" });
    return { task_created: true };
  }

  if (kind === "api4com_call" && leadId) {
    const extension = String(blockConfig.extension ?? "").replace(/\D/g, "");
    const phone = normalizeWhatsAppPhone(String(lead.phone ?? ""));
    if (!extension) return { skipped: "ramal Api4com ausente" };
    if (!phone) return { skipped: "telefone do lead invalido" };
    const call = await triggerApi4comCall({
      extension,
      phone: `+${phone}`,
      metadata: { tenant_id: tenantId, lead_id: leadId, automation_execution_id: executionId },
    });
    await supabase.from("lead_activities").insert({
      tenant_id: tenantId,
      lead_id: leadId,
      kind: "call",
      payload: {
        provider: "api4com",
        extension,
        call_id: call.id,
        note: interpolate(String(blockConfig.note ?? "Ligacao iniciada por automacao"), lead),
      },
    });
    return { call_started: true, call_id: call.id, extension };
  }

  if (kind === "add_tag" && leadId) {
    const tag = String(blockConfig.tag ?? "");
    if (!tag) return { skipped: "tag nao informada" };
    const { data: currentLead } = await supabase.from("leads").select("tags").eq("id", leadId).single();
    const tags = (currentLead as { tags?: string[] } | null)?.tags ?? [];
    if (!tags.includes(tag)) {
      await supabase.from("leads").update({ tags: [...tags, tag] }).eq("id", leadId).eq("tenant_id", tenantId);
    }
    lead.tags = tags.includes(tag) ? tags : [...tags, tag];
    return { tag_added: tag };
  }

  if (kind === "log_activity" && leadId) {
    const message = interpolate(String(blockConfig.message ?? "Acao automatica"), lead);
    await supabase.from("lead_activities").insert({ tenant_id: tenantId, lead_id: leadId, kind: "automation", payload: { message } });
    return { logged: true };
  }

  if (kind === "field_ops" && leadId) {
    const field = String(blockConfig.field ?? "");
    const value = interpolate(String(blockConfig.value ?? ""), lead);
    const ALLOWED = ["name", "email", "phone", "source", "value", "notes", "stage_id", "assigned_to"];
    if (field && ALLOWED.includes(field)) {
      await supabase.from("leads").update({ [field]: value }).eq("id", leadId).eq("tenant_id", tenantId);
      lead[field] = value;
      return { field, value };
    }
    return { skipped: `campo "${field}" não permitido` };
  }

  if (kind === "create_lead") {
    // Cria um lead novo (ex: indicacao/segundo contato) usando dados do
    // gatilho atual como base, com campos sobrescreviveis no bloco.
    const name = interpolate(String(blockConfig.name ?? lead.name ?? ""), lead).trim();
    const phone = interpolate(String(blockConfig.phone ?? ""), lead).trim();
    const email = interpolate(String(blockConfig.email ?? ""), lead).trim();
    const source = interpolate(String(blockConfig.source ?? "automacao"), lead).trim() || "automacao";
    if (!name) return { skipped: "nome do novo lead nao informado" };

    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("id, pipeline_stages(id, position)")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .maybeSingle();
    const stages = (pipeline as { pipeline_stages?: { id: string; position: number }[] } | null)?.pipeline_stages?.sort(
      (a, b) => a.position - b.position,
    );

    const { data: created } = await supabase
      .from("leads")
      .insert({
        tenant_id: tenantId,
        name,
        phone: phone || null,
        email: email || null,
        source,
        pipeline_id: (pipeline as { id?: string } | null)?.id ?? null,
        stage_id: stages?.[0]?.id ?? null,
      })
      .select("id")
      .single();
    return { lead_created: true, new_lead_id: (created as { id?: string } | null)?.id ?? null };
  }

  if (kind === "create_deal" && leadId) {
    // "Negocio" = pipeline/etapa/valor associados ao lead atual.
    const pipelineId = String(blockConfig.pipeline_id ?? "");
    const stageId = String(blockConfig.stage_id ?? "");
    const valueCents = Number(blockConfig.value_cents ?? 0);
    if (!pipelineId && !stageId) return { skipped: "funil/etapa nao informados" };
    const patch: Record<string, unknown> = {};
    if (pipelineId) patch.pipeline_id = pipelineId;
    if (stageId) patch.stage_id = stageId;
    if (valueCents > 0) patch.value_cents = valueCents;
    await supabase.from("leads").update(patch).eq("id", leadId).eq("tenant_id", tenantId);
    Object.assign(lead, patch);
    return { deal_created: true, ...patch };
  }

  if (kind === "api_call") {
    const url = interpolate(String(blockConfig.url ?? ""), lead);
    const method = String(blockConfig.method ?? "POST").toUpperCase();
    const bodyTemplate = String(blockConfig.body ?? "");
    const body = bodyTemplate ? interpolate(bodyTemplate, lead) : undefined;
    if (!url) return { skipped: "URL ausente" };
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
    return { api_status: resp.status, ok: resp.ok, response: responseText };
  }

  if (kind === "ai") {
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = (process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
    const model = String(blockConfig.model ?? process.env.AI_MODEL ?? "meta/llama-3.3-70b-instruct");
    const prompt = interpolate(String(blockConfig.prompt ?? ""), lead);
    if (!apiKey) return { skipped: "AI_API_KEY não configurada" };
    if (!prompt) return { skipped: "prompt vazio" };
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: `${prompt}\n\nDados do lead (JSON): ${JSON.stringify(lead)}` }],
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
      await supabase.from("lead_activities").insert({ tenant_id: tenantId, lead_id: leadId, kind: "automation", payload: { ai: textOut } });
    }
    const errMsg = typeof data?.error === "string" ? data.error : data?.error?.message;
    return { ai_response: textOut.slice(0, 500), error: errMsg };
  }

  if (kind === "javascript") {
    const code = String(blockConfig.code ?? "");
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("lead", code);
      const out = fn({ ...lead });
      return { js_result: typeof out === "object" ? JSON.stringify(out) : String(out) };
    } catch (jsErr) {
      return { js_error: (jsErr as Error).message };
    }
  }

  return { skipped: `tipo de acao desconhecido: ${kind}` };
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

  // Um fluxo pode ter varios blocos de "Inicio", cada um com seu proprio
  // caminho de acoes (ex: mensagens rapidas diferentes movendo pra etapas
  // diferentes). fireAutomationTrigger grava qual bloco de trigger casou com
  // este disparo em trigger_payload._trigger_block_id; sem isso (execucoes
  // legadas ou outros tipos de gatilho), cai no primeiro bloco encontrado.
  const triggerPayload = execution.trigger_payload as Record<string, unknown> | null;
  const matchedTriggerBlockId = triggerPayload?._trigger_block_id as string | undefined;
  const triggerBlock = matchedTriggerBlockId
    ? blocks.find((b) => b.id === matchedTriggerBlockId)
    : blocks.find((b) => b.type === "trigger");
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
      const actionCtx: ActionCtx = { supabase, tenantId, leadId, lead, executionId };

      if (kind === "action_group") {
        // Bloco "Acao" com uma ou mais sub-acoes, executadas em sequencia.
        const items = Array.isArray(blockConfig.actions)
          ? (blockConfig.actions as { id?: string; kind: string; config?: Record<string, unknown> }[])
          : [];
        const subResults: Record<string, unknown>[] = [];
        for (const item of items) {
          const subResult = await runAction(item.kind, item.config ?? {}, actionCtx);
          subResults.push({ kind: item.kind, ...subResult });
        }
        result = { sub_actions: subResults };
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
      } else {
        // Bloco de acao legado com um unico kind direto (compatibilidade)
        result = await runAction(kind, blockConfig, actionCtx);
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
