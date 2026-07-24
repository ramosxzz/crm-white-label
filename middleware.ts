import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Webhooks tem seu proprio verify-token e nao precisam de sessao. Alem
    // disso o Next.js impoe um limite de 10MB no buffer do middleware
    // (middlewareClientMaxBodySize); payloads maiores da Evolution (media
    // inline em base64) ficavam truncados e quebravam o JSON.parse do
    // webhook. Excluir a rota do middleware evita esse limite por completo.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|pwa/|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
