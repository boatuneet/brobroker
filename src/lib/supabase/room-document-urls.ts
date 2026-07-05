import type { DealRoom, YachtListing } from "@/lib/types";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";

const SIGNED_URL_SECONDS = 60 * 60;

/* Signed download URLs for a room's approved documents — AUTHED variant for
   the broker's in-app room view (the public page uses the service-role
   twin in service.ts). Keyed by document id; metadata-only docs skipped. */
export async function getRoomDocumentUrls(
  room: DealRoom,
  listings: YachtListing[],
): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};

  const approved = listings
    .flatMap((listing) => listing.documents)
    .filter((doc) => room.approvedDocumentIds.includes(doc.id) && doc.filePath);
  if (!approved.length) return {};

  const supabase = await createClient();
  const urls: Record<string, string> = {};
  await Promise.all(
    approved.map(async (doc) => {
      const { data } = await supabase.storage
        .from("broker-documents")
        .createSignedUrl(doc.filePath!, SIGNED_URL_SECONDS);
      if (data?.signedUrl) urls[doc.id] = data.signedUrl;
    }),
  );
  return urls;
}
