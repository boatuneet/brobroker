import { cookies } from "next/headers";
import { ONBOARDING_DONE_COOKIE, parseOnboardingDone } from "./onboarding";
import { getCurrentUser } from "./supabase/current-user";
import { isSupabaseConfigured } from "./supabase/env";
import { createClient } from "./supabase/server";

/* Has this broker completed (or skipped) the /welcome flow?

   Source of truth is profiles.onboarded_at — durable across browsers and
   devices. The cookie remains a fast-path cache: it's set at the same moment
   as the column, so a hit skips the DB read; a miss (fresh device) falls
   through to the profile row. */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const cookieStore = await cookies();
  if (parseOnboardingDone(cookieStore.get(ONBOARDING_DONE_COOKIE)?.value)) {
    return true;
  }

  if (!isSupabaseConfigured()) return false;
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Column may not exist yet (migration not run) — treat as not onboarded;
    // the cookie still covers the session.
    return false;
  }
  return Boolean(data?.onboarded_at);
}
