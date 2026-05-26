import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/* Next.js 16 renamed `middleware.ts` to `proxy.ts`. The function name was
   `middleware`; now the framework looks for a named export `proxy` or a
   default export. Functionality is identical. */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /* Run on every route except:
     - _next internals (static assets, image optimization, prefetches)
     - common static file extensions in /public
     This keeps the proxy fast and avoids pointless Supabase calls. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
