import crypto from "crypto";

/**
 * Valida o header X-Hub-Signature-256 que a Meta (WhatsApp Cloud API e
 * Instagram Messaging usam o mesmo app/app secret) manda em todo POST de
 * webhook - HMAC-SHA256 do corpo bruto da requisicao com o app secret.
 * Precisa do body cru (string, antes de JSON.parse) porque a assinatura e
 * calculada sobre os bytes exatos enviados, nao sobre o objeto reserializado.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const [algo, sigHex] = signatureHeader.split("=");
  if (algo !== "sha256" || !sigHex) return false;

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(sigHex, "hex");
  if (expectedBuf.length !== gotBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, gotBuf);
}
