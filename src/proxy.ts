import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/* Next.js 16 Proxy entry (formerly middleware.ts). Runs before every matched
   request. Delegates to updateSession() which:
   1. Refreshes the Supabase auth token.
   2. Redirects unauthenticated traffic to /login for protected routes.
   3. Bounces signed-in users away from /login and /signup.

   When Supabase isn't configured (placeholder env values, e.g. a fresh
   checkout), updateSession() no-ops so the demo stays browsable. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /* Match everything except Next internals and static assets. Auth-API and
     public routes are still passed through — the gate logic inside
     updateSession() handles letting them past. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff|woff2|ttf|eot)$).*)",
  ],
};
