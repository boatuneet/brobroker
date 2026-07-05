import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { mapStoredDealRoomToDealRoom, type StoredDealRoomRow } from "./deal-rooms";
import { mapStoredAssetToListing, type StoredAssetRow } from "@/lib/stored-listings";
import { readRoomViewings, type RoomViewing } from "@/lib/viewings";
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

/* Insert a buyer question into deal_room_questions using the service role
   (bypasses RLS). The public /api/room-question route is the only caller.
   Returns:
   - { ok: true }        row inserted
   - { ok: true, demo }  service role not configured — demo path, no-op
   - { ok: false, ... }  room missing or DB error
   ponytail: rate limiting is future work. */
export async function insertRoomQuestion(
  roomId: string,
  question: string,
  autoAnswer: string | undefined,
): Promise<
  | { ok: true; demo?: boolean }
  | { ok: false; status: number; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: true, demo: true };

  // Reject unknown rooms so the endpoint isn't an open write sink.
  const { data: roomRow, error: roomError } = await supabase
    .from("deal_rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError) return { ok: false, status: 500, error: roomError.message };
  if (!roomRow) return { ok: false, status: 404, error: "Room not found" };

  const { error } = await supabase.from("deal_room_questions").insert({
    room_id: roomId,
    question,
    auto_answer: autoAnswer ?? null,
  });

  if (error) return { ok: false, status: 500, error: error.message };
  return { ok: true };
}

export const getPublicDealRoomBundle = cache(async (
  roomId: string,
): Promise<{ room: DealRoom; listings: YachtListing[]; viewings: RoomViewing[] } | null> => {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data: roomRow, error: roomError } = await supabase
    .from("deal_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError || !roomRow) return null;

  const room = mapStoredDealRoomToDealRoom(roomRow as StoredDealRoomRow);
  const viewings = readRoomViewings((roomRow as StoredDealRoomRow).payload);
  if (!room.listingIds.length) {
    return { room, listings: [], viewings };
  }

  const { data: assetRows, error: assetsError } = await supabase
    .from("assets")
    .select("*")
    .in("id", room.listingIds);

  if (assetsError || !assetRows) {
    return { room, listings: [], viewings };
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

  return { room, listings, viewings };
});

function getPayloadPhotos(payload: unknown) {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];
  const photos = (payload as { photos?: unknown }).photos;
  return Array.isArray(photos) ? (photos as { storagePath?: string }[]) : [];
}

/* Signed download URLs for a room's APPROVED documents only — the buyer-safe
   subset. Keyed by document id; docs without an uploaded file are skipped
   (metadata-only rows have nothing to download). */
export async function getPublicRoomDocumentUrls(
  room: DealRoom,
  listings: YachtListing[],
): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  if (!supabase) return {};

  const approved = listings
    .flatMap((listing) => listing.documents)
    .filter((doc) => room.approvedDocumentIds.includes(doc.id) && doc.filePath);

  const urls: Record<string, string> = {};
  await Promise.all(
    approved.map(async (doc) => {
      const { data } = await supabase.storage
        .from("broker-documents")
        .createSignedUrl(doc.filePath!, PHOTO_SIGNED_URL_SECONDS);
      if (data?.signedUrl) urls[doc.id] = data.signedUrl;
    }),
  );
  return urls;
}

/* Q&A thread for the public room page — the buyer sees their own room's
   questions and any broker replies. Room id is the access key (same model
   as the room itself); only Q&A fields are projected, never broker PII. */
export type PublicRoomQuestion = {
  id: string;
  question: string;
  autoAnswer: string | null;
  status: "open" | "answered";
  brokerAnswer: string | null;
  askedAt: string;
};

export async function getPublicRoomQuestions(roomId: string): Promise<PublicRoomQuestion[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("deal_room_questions")
    .select("id, question, auto_answer, status, broker_answer, asked_at")
    .eq("room_id", roomId)
    .order("asked_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    question: row.question,
    autoAnswer: row.auto_answer,
    status: row.status === "answered" ? "answered" : "open",
    brokerAnswer: row.broker_answer,
    askedAt: row.asked_at,
  }));
}
