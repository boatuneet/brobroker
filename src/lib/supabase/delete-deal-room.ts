"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Delete a deal room the broker owns. Called from the Deal Rooms workspace
   after a confirmation dialog. Demo rooms (ids not in the deal_rooms table)
   simply no-op on the server and are dropped from the UI optimistically. */
export async function deleteDealRoom(
  roomId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    // Pure demo mode — nothing persisted, so the optimistic UI removal is all
    // that's needed.
    return { ok: true };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in" };
  }

  const { error } = await supabase
    .from("deal_rooms")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("id", roomId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
