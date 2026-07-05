"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/* Mark a deal room as shared: flip status Draft → Active (the stepper's
   "Shared" signal) and stamp payload.sharedAt. Called when the broker copies
   the share link from the buyer-detail share dialog. Read-merge-write on the
   payload so viewings and other keys survive (same pattern as buyer-stage). */
export async function markRoomShared(
  roomId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured — sharing is demo-only here." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Sign in required to share a room." };
  }

  const { data: existing, error: readError } = await supabase
    .from("deal_rooms")
    .select("payload")
    .eq("id", roomId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!existing) return { ok: false, error: "Room not found — save it first." };

  const priorPayload =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("deal_rooms")
    .update({
      status: "Active",
      payload: { ...priorPayload, sharedAt: now },
      updated_at: now,
    })
    .eq("id", roomId)
    .eq("owner_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
