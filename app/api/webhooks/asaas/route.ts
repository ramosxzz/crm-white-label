import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AsaasWebhookPayload = {
  event: string;
  payment?: {
    subscription?: string;
    customer?: string;
    dueDate?: string;
  };
};

const OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);
const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

export async function POST(req: NextRequest) {
  // Asaas manda esse header de volta com o valor configurado no cadastro do
  // webhook (Configuracoes > Integracoes > Webhooks) - sem isso, qualquer um
  // que descobrisse a URL conseguiria marcar tenant como pago/atrasado.
  const token = req.headers.get("asaas-access-token");
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as AsaasWebhookPayload | null;
  if (!payload?.event || !payload.payment) {
    return NextResponse.json({ ok: true });
  }

  const isOverdue = OVERDUE_EVENTS.has(payload.event);
  const isPaid = PAID_EVENTS.has(payload.event);
  if (!isOverdue && !isPaid) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();
  const subscriptionId = payload.payment.subscription;
  if (!subscriptionId) return NextResponse.json({ ok: true });

  await supabase
    .from("tenants")
    .update({
      payment_overdue: isOverdue,
      payment_due_at: isOverdue ? (payload.payment.dueDate ?? null) : null,
    })
    .eq("asaas_subscription_id", subscriptionId);

  return NextResponse.json({ ok: true });
}
