"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Cascade delete a buyer's drafts + conversations + buyer row.
   Called from client components (BuyerMemoryProfile). Order matters:
   delete children first so the buyer parent row can be safely removed. */
export async function deleteBuyerCascade(
  buyerId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in" };
  }

  const draftsResult = await supabase
    .from("follow_up_drafts")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("buyer_id", buyerId);

  if (draftsResult.error) {
    return { ok: false, error: draftsResult.error.message };
  }

  const conversationsResult = await supabase
    .from("conversations")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("buyer_id", buyerId);

  if (conversationsResult.error) {
    return { ok: false, error: conversationsResult.error.message };
  }

  const buyerResult = await supabase
    .from("buyers")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("id", buyerId);

  if (buyerResult.error) {
    return { ok: false, error: buyerResult.error.message };
  }

  return { ok: true };
}
