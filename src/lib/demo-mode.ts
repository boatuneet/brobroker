/* Demo-data preference — controls whether the in-bundle demo dataset is
   merged into the broker's workspace. Default: ON (so a fresh checkout looks
   populated). Brokers can flip it off in Profile to see only their own
   Supabase-backed buyers, listings, tasks, etc. */

export const DEMO_MODE_COOKIE = "brobroker_demo";
export const DEMO_MODE_STORAGE_KEY = "brobroker:demo";

/* Cookie value "0" = disabled. Anything else (or absent) = enabled. */
export function parseDemoModeFlag(value: string | undefined | null): boolean {
  if (value === "0" || value === "false" || value === "off") return false;
  return true;
}

export function serializeDemoModeFlag(enabled: boolean): "0" | "1" {
  return enabled ? "1" : "0";
}
