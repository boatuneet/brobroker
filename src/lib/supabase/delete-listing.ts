"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Delete a broker's own listing (asset row) plus its imported photos in
   storage. RLS scopes the delete to the signed-in owner. Deal rooms that
   referenced the listing degrade gracefully (the segment filter drops
   missing asset ids), so no cascade is needed there. */
export async function deleteListing(
  listingId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase isn't configured, so this listing can't be deleted here." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in to delete this listing." };
  }

  // Best-effort: remove the listing's photo folder from storage.
  const folder = `${user.id}/listing-photos/${listingId}`;
  try {
    const { data: files } = await supabase.storage.from("broker-documents").list(folder);
    if (files?.length) {
      await supabase.storage
        .from("broker-documents")
        .remove(files.map((file) => `${folder}/${file.name}`));
    }
  } catch {
    // Orphaned photos are harmless; don't block the row delete on storage.
  }

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("owner_user_id", user.id)
    .eq("id", listingId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
