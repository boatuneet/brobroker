import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/* Public routes that anonymous visitors are allowed to see. Anything else
   redirects unauthenticated traffic to /login.

   Auth API endpoints (/auth/...) must be reachable while signed out so the
   sign-up + sign-out callbacks can run.

   Only the buyer-facing room-question endpoint is public under /api; the rest
   of /api stays gated so anonymous traffic can't hit the AI/compute routes
   (verify-buyer, knowledge-chat, matching) and burn quota. */
/* /api/digest bypasses the middleware because Vercel Cron sends no session
   cookie — the handler itself checks the CRON_SECRET (GET) or verifies the
   user (POST), so it stays gated. */
const PUBLIC_ROUTES = ["/login", "/signup", "/auth", "/room", "/api/room-question", "/api/digest"];

function isPublicRoute(pathname: string): boolean {
  // The marketing landing at "/" is public (logged-out visitors + post-logout).
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/* Runs on every matched request from proxy.ts. Two jobs:
   1. Refresh the Supabase auth token by calling `getClaims()`, which
      validates the JWT signature against the project's published public
      keys. This is the only call safe to trust inside the proxy — never
      use `getSession()` here.
   2. Redirect anonymous traffic away from protected routes. */
export async function updateSession(request: NextRequest) {
  /* If Supabase env vars are missing or still placeholder values, skip
     auth entirely so the app stays browsable while .env.local is set up. */
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  /* getClaims() refreshes the token if needed AND validates the signature.
     It is the only auth call safe to trust in proxy/middleware code. */
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  if (!isAuthenticated && !isPublicRoute(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    /* Treat "/" as "/dashboard" for the redirect target so visitors land
       on the dashboard after login instead of bouncing through "/". */
    const target =
      request.nextUrl.pathname === "/" ? "/dashboard" : request.nextUrl.pathname;
    loginUrl.searchParams.set("next", target);
    return NextResponse.redirect(loginUrl);
  }

  /* Signed-in users hitting the landing, /login or /signup get bounced to the
     dashboard so the app opens where they expect. */
  if (
    isAuthenticated &&
    (request.nextUrl.pathname === "/" ||
      request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
