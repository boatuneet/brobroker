"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { RoomViewing } from "@/lib/viewings";

/* Read-merge-write on deal_rooms.payload.viewings — same pattern as
   buyer-stage.ts. Demo rooms aren't in the DB so the update matches 0
   rows; we still return ok since the caller keeps optimistic local state. */

export type SaveRoomViewingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveRoomViewings(
  roomId: string,
  viewings: RoomViewing[],
): Promise<SaveRoomViewingsResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true }; // demo/local-only — treat as success
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Sign in required to save viewings." };
  }

  const { data: existing, error: readError } = await supabase
    .from("deal_rooms")
    .select("payload")
    .eq("id", roomId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  const priorPayload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};

  const nextPayload = { ...priorPayload, viewings };

  const { error } = await supabase
    .from("deal_rooms")
    .update({ payload: nextPayload })
    .eq("id", roomId)
    .eq("owner_user_id", user.id);

  // Demo rooms → not in DB → update touches 0 rows and returns no error.
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
