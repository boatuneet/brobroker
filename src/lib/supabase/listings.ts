import { cache } from "react";
import { type BrokerSegment } from "@/lib/broker-segments";
import { mapStoredAssetToListing, type StoredAssetRow } from "@/lib/stored-listings";
import type { ListingPhoto, YachtListing } from "@/lib/types";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";

const PHOTO_SIGNED_URL_SECONDS = 60 * 60;

export const getStoredListingsForSegment = cache(async (segment?: BrokerSegment) => {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (segment) {
    query = query.eq("asset_type", segment);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("Could not read Supabase listings", error.message);
    return [];
  }

  return Promise.all((data ?? []).map((row) => hydrateStoredListing(row as StoredAssetRow)));
});

export const getStoredListingById = cache(async (id: string) => {
  if (!isSupabaseConfigured()) return undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return undefined;

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Could not read Supabase listing", error.message);
    return undefined;
  }

  return data ? hydrateStoredListing(data as StoredAssetRow) : undefined;
});

async function hydrateStoredListing(row: StoredAssetRow): Promise<YachtListing> {
  const photoUrls = await signListingPhotos(row);
  return mapStoredAssetToListing(row, photoUrls);
}

async function signListingPhotos(row: StoredAssetRow) {
  const photos = getPayloadPhotos(row.payload);
  const storagePaths = photos
    .map((photo) => photo.storagePath)
    .filter((path): path is string => Boolean(path));

  if (!storagePaths.length) return {};

  const supabase = await createClient();
  const signedEntries = await Promise.all(
    storagePaths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from("broker-documents")
        .createSignedUrl(path, PHOTO_SIGNED_URL_SECONDS);

      return error || !data?.signedUrl ? undefined : [path, data.signedUrl] as const;
    }),
  );

  return Object.fromEntries(signedEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}

function getPayloadPhotos(payload: unknown): ListingPhoto[] {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];
  const photos = (payload as { photos?: unknown }).photos;
  return Array.isArray(photos) ? (photos as ListingPhoto[]) : [];
}
