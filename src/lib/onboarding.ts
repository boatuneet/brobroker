/* Onboarding completion flag. Cookie-based (like demo mode + segment) so the
   server can decide whether to route a fresh broker to /welcome without a
   schema migration. Set when the broker finishes or skips the welcome flow;
   a broker with real data never sees onboarding regardless of the cookie.

   ponytail: cookie is per-browser — a fresh device replays onboarding until
   the broker has data. Move to a broker_profiles column if that ever annoys. */
export const ONBOARDING_DONE_COOKIE = "bb-onboarding-done";

export function serializeOnboardingDone(): string {
  return "1";
}

export function parseOnboardingDone(value: string | undefined): boolean {
  return value === "1";
}
