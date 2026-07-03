import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";

const INSTAGRAM_APP_ID = process.env.META_INSTAGRAM_APP_ID!;
// Chave secreta do app do Instagram (diferente do Facebook app secret)
const INSTAGRAM_APP_SECRET = process.env.META_INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
const REDIRECT_URI = `${APP_URL}/api/auth/instagram/callback`;

async function subscribeInstagramWebhooks(accessToken: string): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: "messages,messaging_postbacks",
    access_token: accessToken,
  });
  const res = await fetch(`https://graph.instagram.com/v25.0/me/subscribed_apps?${params.toString()}`, {
    method: "POST",
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error("[instagram] subscribed_apps failed", res.status, raw.slice(0, 300));
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    const reason = searchParams.get("error_reason") ?? "cancelled";
    return NextResponse.redirect(`${APP_URL}/integrations/instagram?error=${reason}`);
  }

  try {
    if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
      return NextResponse.redirect(`${APP_URL}/integrations/instagram?error=missing_app_secret`);
    }

    // 1. Troca code por short-lived token (Instagram Business Login)
    const tokenBody = new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    });

    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      const errMsg = tokenData.error_message ?? tokenData.error?.message ?? JSON.stringify(tokenData);
      console.error("Token exchange failed:", JSON.stringify(tokenData));
      return NextResponse.redirect(
        `${APP_URL}/integrations/instagram?error=${encodeURIComponent(errMsg)}`,
      );
    }

    // A resposta pode vir como objeto único ou array (data[0])
    const tokenInfo = Array.isArray(tokenData.data) ? tokenData.data[0] : tokenData;
    const shortToken: string = tokenInfo.access_token;
    const instagramUserId: string = String(tokenInfo.user_id);

    // 2. Troca por long-lived token (60 dias)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortToken}`,
    );
    const longData = await longRes.json();
    const longToken: string = longData.access_token ?? shortToken;

    // 3. Busca info da conta
    const meRes = await fetch(
      `https://graph.instagram.com/v25.0/me?fields=id,username&access_token=${longToken}`,
    );
    const meData = await meRes.json();
    const resolvedInstagramUserId: string = String(meData.id ?? instagramUserId);
    const displayName: string = meData.username ?? `Instagram ${resolvedInstagramUserId}`;

    const ctx = await requireContext();
    const supabase = await createClient();

    const verifyToken = `ig-${ctx.tenantId.slice(0, 8)}-${Date.now()}`;

    await supabase.from("instagram_accounts").delete().eq("tenant_id", ctx.tenantId);
    await subscribeInstagramWebhooks(longToken);

    await supabase.from("instagram_accounts").upsert(
      {
        tenant_id: ctx.tenantId,
        // Para Instagram Business Login, page_id = Instagram Business Account ID
        page_id: resolvedInstagramUserId,
        page_access_token: longToken,
        instagram_business_account_id: resolvedInstagramUserId,
        display_name: displayName,
        webhook_verify_token: verifyToken,
        is_active: true,
      },
      { onConflict: "tenant_id,page_id" },
    );

    return NextResponse.redirect(`${APP_URL}/integrations/instagram?success=1`);
  } catch (err) {
    console.error("Instagram OAuth error:", err);
    return NextResponse.redirect(`${APP_URL}/integrations/instagram?error=oauth_failed`);
  }
}
