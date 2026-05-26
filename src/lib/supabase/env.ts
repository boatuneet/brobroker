/* Centralized env detection so proxy.ts, server.ts, and the AppShell can all
   agree on whether Supabase is wired up. Treats the placeholder values shipped
   in .env.local as "not configured" — without this check the prototype would
   crash on every request before the broker pastes real keys. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return false;
  if (url.includes("YOUR-PROJECT-REF")) return false;
  if (key.includes("REPLACE_ME")) return false;

  return true;
}
