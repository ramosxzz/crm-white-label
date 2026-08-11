import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/supabase/server";

type SignedRequestPayload = {
  user_id?: string;
  algorithm?: string;
  issued_at?: number;
};

function decodeSignedRequest(signedRequest: string, appSecret: string): SignedRequestPayload | null {
  try {
    const [encodedSignature, encodedPayload] = signedRequest.split(".");
    if (!encodedSignature || !encodedPayload) return null;

    const signature = Buffer.from(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const expected = crypto.createHmac("sha256", appSecret).update(encodedPayload).digest();
    if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SignedRequestPayload;
    if (payload.algorithm && payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET ?? process.env.META_INSTAGRAM_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "Meta app secret is not configured" }, { status: 500 });
  }

  const formData = await request.formData().catch(() => null);
  const signedRequest = formData?.get("signed_request");
  if (typeof signedRequest !== "string") {
    return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
  }

  const payload = decodeSignedRequest(signedRequest, appSecret);
  if (!payload?.user_id) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  const confirmationCode = `meta-del-${crypto.randomUUID()}`;
  const externalUserHash = crypto.createHash("sha256").update(payload.user_id).digest("hex");
  // A migration desta feature e aplicada antes da proxima regeneracao dos tipos.
  // O cast fica restrito a esta tabela e pode ser removido apos `supabase:types`.
  const supabase = createServiceClient() as any;
  const { error } = await supabase.from("meta_data_deletion_requests").insert({
    confirmation_code: confirmationCode,
    external_user_id_hash: externalUserHash,
    status: "pending",
  });

  if (error) {
    console.error("[meta data deletion] failed to record request", error.message);
    return NextResponse.json({ error: "Unable to record deletion request" }, { status: 500 });
  }

  const appUrl = await getAppBaseUrl();
  return NextResponse.json({
    url: `${appUrl}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
    confirmation_code: confirmationCode,
  });
}
