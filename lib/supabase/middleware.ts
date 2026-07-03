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
    url.pathname.startsWith("/api/health") ||
    url.pathname.startsWith("/api/webhooks") ||
    url.pathname.startsWith("/api/intake") ||
    url.pathname.startsWith("/api/automations/process") ||
    url.pathname.startsWith("/api/cron") ||
    url.pathname === "/" ||
    url.pathname.startsWith("/privacy") ||
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

  const { data: { user } } = await supabase.auth.getUser();

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
