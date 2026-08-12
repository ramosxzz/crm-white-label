import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { toJson } from "@/lib/utils";

const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;
const GRAPH_VERSION = "v23.0";

export async function POST(req: NextRequest) {
  try {
    const { code, wabaId, phoneNumberId, businessId, pin } = (await req.json()) as {
      code?: string;
      wabaId?: string;
      phoneNumberId?: string;
      businessId?: string;
      pin?: string;
    };

    if (!code) {
      return NextResponse.json({ error: "Codigo de autorizacao ausente" }, { status: 400 });
    }
    if (!wabaId || !phoneNumberId) {
      return NextResponse.json(
        { error: "Numero ou conta do WhatsApp Business nao identificados. Refaca o processo." },
        { status: 400 },
      );
    }
    if (!/^\d{6}$/.test(pin ?? "")) {
      return NextResponse.json({ error: "Crie um PIN de 6 digitos para registrar o numero na Meta" }, { status: 400 });
    }
    if (!APP_ID || !APP_SECRET) {
      return NextResponse.json({ error: "Configuracao do Meta App ausente no servidor" }, { status: 500 });
    }

    // 1. Troca o code (JS SDK, sem redirect_uri) por token de usuario
    const tokenParams = new URLSearchParams({
      client_id: APP_ID,
      client_secret: APP_SECRET,
      code,
    });
    const tokenRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      const msg = tokenData.error?.message ?? JSON.stringify(tokenData);
      return NextResponse.json({ error: `Falha ao trocar codigo por token: ${msg}` }, { status: 400 });
    }

    // 2. Troca por token de longa duracao (60 dias)
    const longParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: tokenData.access_token,
    });
    const longRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${longParams.toString()}`);
    const longData = await longRes.json();
    const accessToken: string = longData.access_token ?? tokenData.access_token;

    // 3. Assina o app na WABA
    await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);

    // 4. Registra o numero na Cloud API (numero ja verificado por OTP durante o Embedded Signup)
    const registerRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    const registerData = await registerRes.json().catch(() => ({}));
    if (!registerRes.ok) {
      const message = registerData.error?.error_data?.details || registerData.error?.message || "A Meta recusou o registro";
      return NextResponse.json({ error: `Numero verificado, mas o registro na Cloud API falhou: ${message}` }, { status: 400 });
    }

    // 5. Busca dados do numero
    const phoneRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const phoneData = await phoneRes.json();

    const ctx = await requireContext();
    const supabase = await createClient();

    const credentials: Record<string, unknown> = {
      access_token: accessToken,
      phone_number_id: phoneNumberId,
      business_account_id: wabaId,
      graph_version: GRAPH_VERSION,
      meta_business_id: businessId ?? null,
      webhooks_synced_at: new Date().toISOString(),
      registered: true,
      registered_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("whatsapp_accounts")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("provider", "cloud_api")
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .update({
          phone_number: (phoneData.display_phone_number ?? "").replace(/\D/g, ""),
          display_name: phoneData.verified_name ?? null,
          credentials: toJson(credentials),
          is_active: true,
        })
        .eq("id", existing.id)
        .eq("tenant_id", ctx.tenantId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("whatsapp_accounts").insert({
        tenant_id: ctx.tenantId,
        provider: "cloud_api",
        phone_number: (phoneData.display_phone_number ?? "").replace(/\D/g, ""),
        display_name: phoneData.verified_name ?? null,
        credentials: toJson(credentials),
        is_active: true,
      });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[whatsapp embedded signup] erro:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
