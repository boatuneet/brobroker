import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/* Server-side Supabase client for Server Components, Server Actions, and
   Route Handlers. A fresh client is created per request because cookies
   change per request — see Supabase SSR guide:
   https://supabase.com/docs/guides/auth/server-side/nextjs

   `cookies()` is async in Next.js 16, so this helper is async too. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* The `setAll` method was called from a Server Component.
               This can be ignored if you have a Proxy (proxy.ts) refreshing
               user sessions, which we do. */
          }
        },
      },
    },
  );
}
