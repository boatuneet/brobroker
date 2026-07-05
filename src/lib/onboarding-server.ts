import { cookies } from "next/headers";
import { ONBOARDING_DONE_COOKIE, parseOnboardingDone } from "./onboarding";

/* Server-side read of the onboarding flag (mirrors demo-mode-server.ts). */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const cookieStore = await cookies();
  return parseOnboardingDone(cookieStore.get(ONBOARDING_DONE_COOKIE)?.value);
}
