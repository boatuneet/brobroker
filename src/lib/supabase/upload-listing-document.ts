"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Document file storage for listings. Reuses the existing private
   `broker-documents` bucket (same one listing photos use), namespaced under
   the owner + listing so files never collide across brokers. Files are
   private — we hand out short-lived signed URLs to view them, never public
   URLs, so approved-doc access stays broker-gated. */

const BUCKET = "broker-documents";
const SIGNED_URL_SECONDS = 60 * 60; // 1 hour — long enough to open/download.

function safeStorageName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

export type UploadDocumentResult =
  | { ok: true; filePath: string }
  | { ok: false; error: string };

export async function uploadListingDocument(
  listingId: string,
  documentId: string,
  file: File,
): Promise<UploadDocumentResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured — file upload is unavailable in demo mode." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to upload documents." };
  }

  const path = `${user.id}/listing-docs/${listingId}/${documentId}-${safeStorageName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, filePath: path };
}

/* Generate a short-lived signed URL to view/download a stored document.
   Returns null when unavailable (demo mode, missing file, or expired). */
export async function getDocumentSignedUrl(filePath: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
}
