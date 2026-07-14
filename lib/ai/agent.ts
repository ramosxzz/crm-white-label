import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";

type AiAgentRow = {
  enabled: boolean;
  name: string;
  system_prompt: string;
  model: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAiAgentReply(
  supabase: SupabaseClient<any>,
  params: { tenantId: string; leadId: string; conversationId: string; incomingBody: string },
): Promise<string | null> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || !params.incomingBody.trim()) return null;

  const [{ data: agent }, { data: lead }] = await Promise.all([
    supabase
      .from("ai_agents")
      .select("enabled, name, system_prompt, model")
      .eq("tenant_id", params.tenantId)
      .maybeSingle(),
    supabase
      .from("leads")
      .select("automations_enabled")
      .eq("id", params.leadId)
      .maybeSingle(),
  ]);

  const agentRow = agent as AiAgentRow | null;
  if (!agentRow?.enabled || !agentRow.system_prompt.trim()) return null;

  // Mesmo interruptor usado pelas automacoes: atendente humano assumiu, IA nao responde.
  const leadRow = lead as { automations_enabled?: boolean | null } | null;
  if (leadRow?.automations_enabled === false) return null;

  const { data: history } = await supabase
    .from("messages")
    .select("direction, body")
    .eq("conversation_id", params.conversationId)
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);

  const historyMessages = ((history ?? []) as { direction: string; body: string | null }[])
    .reverse()
    .filter((m) => m.body)
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.body as string,
    }));

  const baseUrl = (process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const model = agentRow.model || process.env.AI_MODEL || DEFAULT_MODEL;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: agentRow.system_prompt }, ...historyMessages],
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content?.trim();
  return text || null;
}
