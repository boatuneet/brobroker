import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
};

/* Read the current user's profile row. Returns null when the row hasn't been
   created yet (the on-signup trigger should prevent this in normal flow, but
   we handle it gracefully for projects that haven't run the SQL migration). */
export async function fetchOwnProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Could not read profile", error.message);
    return null;
  }
  return (data as ProfileRow) ?? null;
}

/* Upsert the profile row. Pass undefined to leave a field unchanged. */
export async function upsertOwnProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    full_name?: string | null;
    avatar_url?: string | null;
    onboarded_at?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload: Record<string, unknown> = { id: userId };
  if (patch.full_name !== undefined) payload.full_name = patch.full_name;
  if (patch.avatar_url !== undefined) payload.avatar_url = patch.avatar_url;
  if (patch.onboarded_at !== undefined) payload.onboarded_at = patch.onboarded_at;

  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* Upload a new avatar image to the user's folder in the avatars bucket and
   return the public URL. Folder layout matches the storage RLS policy:
     <userId>/<timestamp>-<filename> */
export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: "Avatar uploaded but URL could not be resolved." };
  }
  return { ok: true, url: data.publicUrl };
}
