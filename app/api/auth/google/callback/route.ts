import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireContext } from "@/lib/tenant";
import { exchangeGoogleCode, fetchGoogleUserEmail } from "@/lib/google/oauth";
import { encryptSecret } from "@/lib/crypto/secret-box";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/integrations/gmail?error=${error ?? "cancelled"}`);
  }

  try {
    const ctx = await requireContext();
    if (state !== ctx.tenantId) {
      return NextResponse.redirect(`${APP_URL}/integrations/gmail?error=state_mismatch`);
    }

    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refresh_token) {
      // Google so manda refresh_token na PRIMEIRA autorizacao (prompt=consent
      // forca isso, mas se o usuario ja tinha autorizado esse app antes com
      // outra conta do Google, pode nao vir). Sem ele nao da pra renovar o
      // access_token depois que expira (1h) - pede pra revogar o acesso em
      // myaccount.google.com/permissions e tentar de novo.
      return NextResponse.redirect(`${APP_URL}/integrations/gmail?error=no_refresh_token`);
    }

    const googleEmail = await fetchGoogleUserEmail(tokens.access_token);
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const supabase = await createClient();
    const { error: dbError } = await supabase.from("google_accounts").upsert(
      {
        tenant_id: ctx.tenantId,
        connected_by: ctx.userId,
        google_email: googleEmail,
        access_token: encryptSecret(tokens.access_token),
        refresh_token: encryptSecret(tokens.refresh_token),
        token_expiry: tokenExpiry,
        scope: tokens.scope,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );
    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(`${APP_URL}/integrations/gmail?success=1`);
  } catch (err) {
    console.error("[google oauth] callback error", err);
    return NextResponse.redirect(`${APP_URL}/integrations/gmail?error=oauth_failed`);
  }
}
