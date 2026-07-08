import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { triggerApi4comCall } from "@/lib/integrations/api4com";

const bodySchema = z.object({
  leadId: z.string().uuid(),
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
      metadata: { tenant_id: ctx.tenantId, lead_id: parsed.leadId, user_id: ctx.userId },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao iniciar ligacao";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
