"use client";

import type { DocumentAsset } from "@/lib/types";
import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Persist a listing's documents array after the broker approves or unapproves a
   single document from the Documents tab. Mirrors delete-deal-room.ts /
   buyer-stage.ts: no-op in demo mode (returns ok), owner-scoped write on the
   assets table otherwise. `documents` is a jsonb column on `assets` — see
   src/lib/stored-listings.ts (row.documents is passed through as-is).

   The caller passes the full next documents array (already merged in local
   component state) so this helper doesn't need to read-then-write; the whole
   column is small (a handful of DocumentAsset rows) and overwriting it keeps
   the helper trivial. If two brokers ever race approvals on the same listing,
   last write wins — acceptable for a status toggle, and matches how deal-room
   metadata is written elsewhere. */
export async function updateListingDocuments(
  listingId: string,
  documents: DocumentAsset[],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    // Demo / no-Supabase mode — optimistic UI is the source of truth.
    return { ok: true };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in to update document approvals." };
  }

  const { error, data } = await supabase
    .from("assets")
    .update({ documents })
    .eq("owner_user_id", user.id)
    .eq("id", listingId)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }

  // No matching row (demo listing id, or listing owned by someone else) —
  // treat as a graceful no-op so the optimistic UI can stand. This mirrors
  // delete-deal-room.ts's stance on demo rows.
  if (!data || data.length === 0) {
    return { ok: true };
  }

  return { ok: true };
}
