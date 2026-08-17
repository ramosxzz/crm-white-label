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
  // Repassa o pathname atual pro Server Component via header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const forwardedRequest = { headers: requestHeaders };

  let response = NextResponse.next({ request: forwardedRequest });
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
          response = NextResponse.next({ request: forwardedRequest });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  if (!user && !isPublic) {
    url.pathname = "/login";
    return noStore(NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    // Login restrito a Agenda/OS: manda direto pra /os/agenda em vez de
    // /dashboard -> layout.tsx redirect. Esse salto duplo (dashboard
    // renderizando ate o layout perceber e redirecionar de novo, dentro de
    // Server Component ja carregando a Agenda inteira) e o que causava tela
    // preta no primeiro login dessas contas.
    const cookieTenant = request.cookies.get("avante_tenant_id")?.value;
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("tenant_id, os_only_access")
      .eq("user_id", user.sub);
    const chosen =
      memberships?.find((m) => m.tenant_id === cookieTenant) ?? memberships?.[0];
    url.pathname = chosen?.os_only_access ? "/os/agenda" : "/dashboard";
    return noStore(NextResponse.redirect(url));
  }

  return response;
}
