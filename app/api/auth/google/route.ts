import { NextResponse } from "next/server";
import { requireContext } from "@/lib/tenant";
import { canManageIntegrations } from "@/lib/auth/roles";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET() {
  const ctx = await requireContext();
  if (!canManageIntegrations(ctx.role)) {
    return NextResponse.redirect(`${APP_URL}/integrations/gmail?error=sem_permissao`);
  }
  // O state carrega o tenant_id pra conferir no callback que a sessao que
  // voltou do Google e a mesma que iniciou o fluxo (evita mistura de tenant
  // se o admin trocar de conta/aba no meio do caminho).
  const url = buildGoogleAuthUrl(ctx.tenantId);
  return NextResponse.redirect(url);
}
