import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function updateSession(request: NextRequest) {
  let response = noStore(NextResponse.next({ request }));
  const url = request.nextUrl.clone();
  const isLoginRoute = url.pathname.startsWith("/login");
  const isSignupRoute = url.pathname.startsWith("/signup");
  const isAuthRoute = isLoginRoute || isSignupRoute;
  const isPublic =
    isAuthRoute ||
    url.pathname.startsWith("/api/auth/signup") ||
    url.pathname.startsWith("/api/auth/instagram") ||
    url.pathname.startsWith("/api/auth/meta/data-deletion") ||
    url.pathname.startsWith("/api/health") ||
    url.pathname.startsWith("/api/webhooks") ||
    url.pathname.startsWith("/api/intake") ||
    // API publica v1: autenticada por chave de API propria (Authorization:
    // Bearer), nao por sessao/cookie - sem isso, toda chamada externa sem
    // cookie de login era redirecionada pra /login antes de chegar na rota.
    url.pathname.startsWith("/api/v1") ||
    url.pathname.startsWith("/api-docs") ||
    url.pathname.startsWith("/api/automations/process") ||
    url.pathname.startsWith("/api/cron") ||
    url.pathname === "/" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname.startsWith("/privacy") ||
    url.pathname.startsWith("/data-deletion") ||
    url.pathname.startsWith("/terms") ||
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/favicon");

  if (isPublic && !isAuthRoute) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = noStore(NextResponse.next({ request }));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifica o JWT localmente via JWKS (projeto usa chave
  // assimetrica) em vez de bater no servidor de Auth a cada navegacao como
  // getUser() fazia - middleware roda em toda requisicao, entao isso tirava
  // um round-trip de rede de cada clique do sistema inteiro.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (!user && !isPublic) {
    url.pathname = "/login";
    return noStore(NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    url.pathname = "/dashboard";
    return noStore(NextResponse.redirect(url));
  }

  return response;
}
