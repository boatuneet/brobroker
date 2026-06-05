import { cache } from "react";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";

/* auth.getUser() validates the session token over the network, and every
   server-side read needs the user id. Without caching, a single page that reads
   buyers + listings + conversations + drafts + tasks would make one auth
   round-trip PER read. React's request-scoped cache() collapses them to one
   call per request — a meaningful navigation speedup when Supabase is wired up.
   Returns null (no network) when Supabase isn't configured. */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
