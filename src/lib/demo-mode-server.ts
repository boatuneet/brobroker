import { cookies } from "next/headers";
import { DEMO_MODE_COOKIE, parseDemoModeFlag } from "./demo-mode";

/* Returns true when the broker wants demo data merged into their workspace.
   Read in server pages; defaults to true so first-run users see something. */
export async function isDemoModeEnabled(): Promise<boolean> {
  const cookieStore = await cookies();
  return parseDemoModeFlag(cookieStore.get(DEMO_MODE_COOKIE)?.value);
}
