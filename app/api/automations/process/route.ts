import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processExecution } from "@/lib/automations/execute";
import { processScheduledMessages } from "@/lib/chat/process-scheduled";
import { processAppointmentReminders } from "@/lib/agenda/reminders";

export const dynamic = "force-dynamic";

// Called by Cloudflare Cron or manually to process pending automation steps
export async function POST(req: NextRequest) {
  // Bearer auth via CRON_SECRET env var - falha fechado: sem CRON_SECRET
  // configurado, a rota fica bloqueada (nunca aberta por omissao), ja que
  // ela processa automacoes/mensagens agendadas/lembretes de TODOS os
  // tenants sem nenhuma outra protecao (esta fora do gate de sessao do
  // middleware).
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[automations/process] CRON_SECRET nao configurado - bloqueando requisicao.");
    return NextResponse.json({ error: "Servico nao configurado" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Resume waiting steps whose resume_at has passed
  const { data: waitingSteps } = await supabase
    .from("automation_execution_steps")
    .select("id, execution_id, tenant_id")
    .eq("status", "waiting")
    .lte("resume_at", new Date().toISOString())
    .limit(50);

  for (const step of waitingSteps ?? []) {
    // Mark as pending so execute() can pick it up
    await supabase
      .from("automation_execution_steps")
      .update({ status: "pending" })
      .eq("id", step.id);

    // Re-run the execution
    await processExecution(supabase, step.execution_id as string);
  }

  // Process newly queued executions (start step = pending)
  const { data: pendingExecutions } = await supabase
    .from("automation_executions")
    .select("id")
    .eq("status", "running")
    .limit(50);

  let processed = 0;
  for (const exec of pendingExecutions ?? []) {
    const hasPending = await supabase
      .from("automation_execution_steps")
      .select("id")
      .eq("execution_id", exec.id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (hasPending.data) {
      await processExecution(supabase, exec.id as string);
      processed++;
    }
  }

  // Envia mensagens agendadas cujo horário já passou
  const scheduledSent = await processScheduledMessages(supabase);

  // Envia confirmações de reunião (12h / 2h / 30min antes)
  const remindersSent = await processAppointmentReminders(supabase);

  return NextResponse.json({
    ok: true,
    processed,
    resumed: waitingSteps?.length ?? 0,
    scheduledSent,
    remindersSent,
  });
}
