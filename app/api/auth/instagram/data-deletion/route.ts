import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

const APP_SECRET = process.env.META_INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

function parseSignedRequest(signedRequest: string): { user_id: string } | null {
  try {
    const [encodedSig, payload] = signedRequest.split(".");
    const sig = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const expected = crypto.createHmac("sha256", APP_SECRET).update(payload).digest();
    if (!crypto.timingSafeEqual(sig, expected)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// Meta chama este endpoint via POST com signed_request quando o usuário
// solicita exclusão de dados pelo Facebook/Instagram.
export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null);
  const signedRequest = body?.get("signed_request");

  if (!signedRequest || typeof signedRequest !== "string") {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const data = parseSignedRequest(signedRequest);
  if (!data?.user_id) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const instagramUserId = data.user_id;

  // Remove a conta Instagram com esse user_id e os leads vinculados
  const supabase = await createClient();
  await supabase
    .from("instagram_accounts")
    .delete()
    .eq("page_id", instagramUserId);

  await supabase
    .from("leads")
    .delete()
    .eq("instagram_sender_id", instagramUserId);

  const confirmationCode = `del-${instagramUserId}-${Date.now()}`;

  return NextResponse.json({
    url: `${APP_URL}/api/auth/instagram/data-deletion/status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// Endpoint de status que o Meta pode verificar
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code") ?? "unknown";
  return NextResponse.json({
    status: "completed",
    confirmation_code: code,
    message: "Os dados vinculados a esta conta Instagram foram removidos.",
  });
}
