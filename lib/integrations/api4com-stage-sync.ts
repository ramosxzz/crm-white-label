import type { Api4comCall } from "@/lib/integrations/api4com";

const MAX_CALL_ATTEMPT_STAGE = 5;

type StageRow = {
  id: string;
  pipeline_id: string;
  name: string;
  position: number | null;
  is_won: boolean | null;
  is_lost: boolean | null;
};

type LeadRow = {
  id: string;
  pipeline_id: string | null;
  stage_id: string | null;
};

export type CallAttemptStageSync = {
  leadId: string;
  attempt: number;
  stageId: string;
  stageName: string;
  pipelineId: string;
};

function normalizeStageName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function callAttemptStageName(attempt: number) {
  const safeAttempt = Math.min(Math.max(Math.trunc(attempt) || 1, 1), MAX_CALL_ATTEMPT_STAGE);
  return `Tentativa ${safeAttempt}`;
}

function getLeadId(call: Api4comCall) {
  const leadId = (call.metadata as Record<string, unknown> | null)?.lead_id;
  return typeof leadId === "string" && leadId ? leadId : null;
}

function getTenantId(call: Api4comCall) {
  const tenantId = (call.metadata as Record<string, unknown> | null)?.tenant_id;
  return typeof tenantId === "string" && tenantId ? tenantId : null;
}

function pickStage(stages: StageRow[], targetName: string, preferredPipelineId: string | null) {
  const normalizedTarget = normalizeStageName(targetName);
  const matches = stages.filter((stage) => normalizeStageName(stage.name) === normalizedTarget);
  if (preferredPipelineId) {
    const samePipeline = matches.find((stage) => stage.pipeline_id === preferredPipelineId);
    if (samePipeline) return samePipeline;
  }
  return matches[0] ?? null;
}

export async function moveLeadToCallAttemptStage(
  supabase: any,
  input: {
    tenantId: string;
    leadId: string;
    attempt: number;
    userId?: string | null;
    source?: string;
  },
): Promise<CallAttemptStageSync | null> {
  const targetName = callAttemptStageName(input.attempt);

  const { data: lead } = await supabase
    .from("leads")
    .select("id, pipeline_id, stage_id")
    .eq("id", input.leadId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!lead) return null;
  const leadRow = lead as LeadRow;

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, pipeline_id, name, position, is_won, is_lost")
    .eq("tenant_id", input.tenantId)
    .order("position");
  const stageRows = (stages ?? []) as StageRow[];
  const currentStage = leadRow.stage_id ? stageRows.find((stage) => stage.id === leadRow.stage_id) : null;
  if (currentStage?.is_won || currentStage?.is_lost) return null;

  const targetStage = pickStage(stageRows, targetName, leadRow.pipeline_id);
  if (!targetStage) return null;

  if (leadRow.stage_id !== targetStage.id || leadRow.pipeline_id !== targetStage.pipeline_id) {
    const { error } = await supabase
      .from("leads")
      .update({
        stage_id: targetStage.id,
        pipeline_id: targetStage.pipeline_id,
      })
      .eq("id", input.leadId)
      .eq("tenant_id", input.tenantId);
    if (error) throw new Error(error.message);

    await supabase.from("lead_activities").insert({
      tenant_id: input.tenantId,
      lead_id: input.leadId,
      user_id: input.userId ?? null,
      kind: "stage_changed",
      payload: {
        from_stage_name: currentStage?.name ?? null,
        to_stage_name: targetStage.name,
        reason: "call_attempt",
        attempt: input.attempt,
        source: input.source ?? "api4com",
      },
    });
  }

  return {
    leadId: input.leadId,
    attempt: input.attempt,
    stageId: targetStage.id,
    stageName: targetStage.name,
    pipelineId: targetStage.pipeline_id,
  };
}

export async function syncLeadStagesFromApi4comCalls(
  supabase: any,
  input: {
    tenantId: string;
    calls: Api4comCall[];
  },
) {
  const attempts = new Map<string, number>();
  const sortedCalls = input.calls
    .filter((call) => getTenantId(call) === input.tenantId)
    .filter((call) => Boolean(getLeadId(call)))
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

  for (const call of sortedCalls) {
    const leadId = getLeadId(call);
    if (!leadId) continue;
    attempts.set(leadId, (attempts.get(leadId) ?? 0) + 1);
  }

  const synced = new Map<string, CallAttemptStageSync>();
  for (const [leadId, attempt] of attempts) {
    const result = await moveLeadToCallAttemptStage(supabase, {
      tenantId: input.tenantId,
      leadId,
      attempt,
      source: "api4com_dashboard",
    });
    if (result) synced.set(leadId, result);
  }

  return synced;
}
