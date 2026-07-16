import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { Api4comError, fetchApi4comCalls, triggerApi4comCall } from "@/lib/integrations/api4com";
import { moveLeadToCallAttemptStage } from "@/lib/integrations/api4com-stage-sync";

const bodySchema = z.object({
  leadId: z.string().uuid().optional(),
  phone: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const ctx = await requireContext();
    const parsed = bodySchema.parse(await request.json());

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("api4com_extension")
      .eq("id", ctx.userId)
      .single();
    const extension = (profile as { api4com_extension: string | null } | null)?.api4com_extension;
    if (!extension) {
      return NextResponse.json(
        { error: "Configure seu ramal da Api4com em Configuracoes antes de ligar." },
        { status: 400 },
      );
    }

    const phone = normalizeWhatsAppPhone(parsed.phone);
    if (!phone) {
      return NextResponse.json({ error: "Telefone invalido" }, { status: 400 });
    }

    const result = await triggerApi4comCall({
      extension,
      phone: `+${phone}`,
      metadata: {
        tenant_id: ctx.tenantId,
        user_id: ctx.userId,
        ...(parsed.leadId ? { lead_id: parsed.leadId } : {}),
      },
    });

    if (parsed.leadId) {
      const { count } = await supabase
        .from("lead_activities")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId)
        .eq("lead_id", parsed.leadId)
        .eq("kind", "api4com_call_started");
      const api4comAttemptCount = await fetchApi4comCalls()
        .then((calls) =>
          calls.filter((call) => {
            const metadata = call.metadata as Record<string, unknown> | null;
            return metadata?.tenant_id === ctx.tenantId && metadata?.lead_id === parsed.leadId;
          }).length,
        )
        .catch(() => 0);
      const attempt = Math.max(count ?? 0, api4comAttemptCount) + 1;

      await (supabase as any).from("lead_activities").insert({
        tenant_id: ctx.tenantId,
        lead_id: parsed.leadId,
        user_id: ctx.userId,
        kind: "api4com_call_started",
        payload: {
          extension,
          phone,
          attempt,
          api4com_call_id: result.id,
        },
      });

      await moveLeadToCallAttemptStage(supabase as any, {
        tenantId: ctx.tenantId,
        leadId: parsed.leadId,
        userId: ctx.userId,
        attempt,
        source: "api4com_call_button",
      }).catch((stageError) => {
        console.error("api4com_call_stage_sync_failed", stageError);
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar ligacao";
    if (error instanceof Api4comError) {
      return NextResponse.json(
        { error: message, details: error.details },
        { status: error.status },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
