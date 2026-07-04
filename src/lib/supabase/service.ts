import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { mapStoredDealRoomToDealRoom, type StoredDealRoomRow } from "./deal-rooms";
import { mapStoredAssetToListing, type StoredAssetRow } from "@/lib/stored-listings";
import type { DealRoom, YachtListing } from "@/lib/types";

/* Service-role Supabase client — used ONLY by the public buyer-facing room
   page (/room/[id]) to fetch a specific room by unguessable id without a
   logged-in session. Bypasses RLS by design, so every helper here MUST
   project only buyer-safe fields and never accept arbitrary user filters.

   ponytail: the room id currently doubles as the share key. A dedicated
   `share_token` column on deal_rooms would harden this later — the row
   already has one, we just don't route by it yet. */

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PHOTO_SIGNED_URL_SECONDS = 60 * 60;

function createServiceClient() {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return null;
  if (SUPABASE_URL.includes("YOUR-PROJECT-REF")) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getPublicDealRoomBundle = cache(async (
  roomId: string,
): Promise<{ room: DealRoom; listings: YachtListing[] } | null> => {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data: roomRow, error: roomError } = await supabase
    .from("deal_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError || !roomRow) return null;

  const room = mapStoredDealRoomToDealRoom(roomRow as StoredDealRoomRow);
  if (!room.listingIds.length) {
    return { room, listings: [] };
  }

  const { data: assetRows, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .in("id", room.listingIds);

  if (assetsError || !assetRows) {
    return { room, listings: [] };
  }

  // Sign the first photo per listing so the buyer sees real imagery.
  const listings = await Promise.all(
    (assetRows as StoredAssetRow[]).map(async (row) => {
      const photos = getPayloadPhotos(row.payload);
      const firstStoragePath = photos.find((p) => p.storagePath)?.storagePath;
      if (!firstStoragePath) return mapStoredAssetToListing(row, {});

      const { data, error } = await supabase.storage
        .from("broker-documents")
        .createSignedUrl(firstStoragePath, PHOTO_SIGNED_URL_SECONDS);

      return mapStoredAssetToListing(
        row,
        error || !data?.signedUrl ? {} : { [firstStoragePath]: data.signedUrl },
      );
    }),
  );

  return { room, listings };
});

function getPayloadPhotos(payload: unknown) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];
  const photos = (payload as { photos?: unknown }).photos;
  return Array.isArray(photos) ? (photos as { storagePath?: string }[]) : [];
}
