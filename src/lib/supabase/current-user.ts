import { cache } from "react";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";

/* Every server-side read needs the signed-in user id. getClaims() verifies the
   JWT signature LOCALLY (no network round-trip when asymmetric signing keys are
   enabled) — unlike getUser(), which calls Supabase Auth on every render and
   adds latency to each navigation on Vercel. RLS still enforces row security at
   the database, so trusting the verified `sub` claim for reads is safe. The
   request-scoped cache() also collapses repeated calls to one per request.
   Returns null (no network) when Supabase isn't configured. */
export const getCurrentUser = cache(async (): Promise<{ id: string } | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? { id: sub } : null;
});
