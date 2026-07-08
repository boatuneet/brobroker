"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/* Set which listing documents are approved (buyer-visible) for a room.
   Owner-scoped write to deal_rooms.approved_document_ids; `.select()` so a
   0-row write (room under another account) surfaces instead of a silent ok.
   Demo rooms (ids not in the table) return a friendly not-persisted result. */
export async function setRoomApprovedDocuments(
  roomId: string,
  approvedDocumentIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured — approvals are session-only here." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Sign in required to approve documents." };
  }

  const { data, error } = await supabase
    .from("deal_rooms")
    .update({
      approved_document_ids: approvedDocumentIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .eq("owner_user_id", user.id)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Room not found under your account — save it first." };
  }
  return { ok: true };
}
