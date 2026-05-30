"use client";

import {
  DEMO_MODE_COOKIE,
  DEMO_MODE_STORAGE_KEY,
  serializeDemoModeFlag,
} from "./demo-mode";

/* Persist the demo-mode preference. Writes the local cookie immediately so
   the next request (or full reload) picks it up, then POSTs to the API route
   so the server-issued cookie matches. */
export async function persistDemoMode(enabled: boolean) {
  const value = serializeDemoModeFlag(enabled);
  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, value);
  document.cookie = `${DEMO_MODE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;

  try {
    await fetch("/api/demo-mode", {
      body: JSON.stringify({ enabled }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    /* Local cookie above is enough for the next request. */
  }
}
