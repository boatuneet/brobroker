"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  fetchOwnProfile,
  uploadAvatar,
  upsertOwnProfile,
} from "@/lib/supabase/profiles";
import { cn } from "@/lib/utils";
import { ToastViewport } from "@/components/app-feedback";

/* Compact editor: avatar dropzone with hover edit overlay, name field, and
   read-only email. Persists via Supabase (profiles table + avatars bucket).
   See supabase/brobroker-profiles.sql for the schema. */
export function ProfileEditor({
  email,
  initialFullName,
  initialAvatarUrl,
  userId,
}: {
  email: string;
  initialFullName: string | null;
  initialAvatarUrl: string | null;
  userId: string | null;
}) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<
    { tone: "success" | "error"; message: string } | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initial = fullName.trim().charAt(0).toUpperCase() || email.charAt(0).toUpperCase() || "?";
  const enabled = userId && isSupabaseConfigured();
  const trimmed = fullName.trim();
  const dirty = trimmed !== (initialFullName ?? "").trim();

  /* initialFullName / initialAvatarUrl come from a server render; if they
     ever need to change, the route already re-renders and remounts the
     editor. No effect needed. */

  function onPickAvatar() {
    fileInputRef.current?.click();
  }

  async function onAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file || !enabled || !userId) return;
    if (!file.type.startsWith("image/")) {
      setToast({ tone: "error", message: "Avatar must be an image file." });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setToast({ tone: "error", message: "Avatar must be under 4 MB." });
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const uploadResult = await uploadAvatar(supabase, userId, file);
    if (!uploadResult.ok) {
      setUploading(false);
      setToast({ tone: "error", message: uploadResult.error });
      return;
    }
    const persist = await upsertOwnProfile(supabase, userId, {
      avatar_url: uploadResult.url,
    });
    setUploading(false);
    if (!persist.ok) {
      setToast({ tone: "error", message: persist.error });
      return;
    }
    /* Add a cache-buster so the new avatar paints immediately even though
       Supabase storage caches by URL. */
    setAvatarUrl(`${uploadResult.url}?v=${Date.now()}`);
    setToast({ tone: "success", message: "Avatar updated." });
  }

  function onSave() {
    if (!enabled || !userId) return;
    startTransition(async () => {
      const supabase = createClient();
      const result = await upsertOwnProfile(supabase, userId, {
        full_name: trimmed || null,
      });
      if (!result.ok) {
        setToast({ tone: "error", message: result.error });
        return;
      }
      /* Re-fetch to confirm state matches the server. */
      await fetchOwnProfile(supabase, userId);
      setToast({ tone: "success", message: "Profile saved." });
    });
  }

  function onClearAvatar() {
    if (!enabled || !userId) return;
    startTransition(async () => {
      const supabase = createClient();
      const result = await upsertOwnProfile(supabase, userId, { avatar_url: null });
      if (!result.ok) {
        setToast({ tone: "error", message: result.error });
        return;
      }
      setAvatarUrl(null);
      setToast({ tone: "success", message: "Avatar removed." });
    });
  }

  return (
    <>
      <div className="grid gap-4">
        {/* Avatar + helper row — avatar at 64px keeps the editor compact. */}
        <div className="flex items-center gap-4">
          <div className="group relative h-16 w-16 shrink-0">
            <button
              aria-label="Change profile picture"
              className="relative h-full w-full overflow-hidden rounded-full border border-[#E7E7E2] bg-[#F1F2EE] transition-transform duration-300 ease-out hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              disabled={!enabled || uploading}
              onClick={onPickAvatar}
              type="button"
            >
              {avatarUrl ? (
                <Image
                  alt="Profile avatar"
                  className="object-cover transition-opacity duration-300"
                  fill
                  sizes="64px"
                  src={avatarUrl}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[1.4rem] font-medium text-[#003C33]">
                  {initial}
                </span>
              )}
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
                )}
              </span>
            </button>
            {avatarUrl ? (
              <button
                aria-label="Remove avatar"
                className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#E7E7E2] bg-white text-[#5F625E] transition-all duration-200 hover:scale-110 hover:text-[#A86642]"
                disabled={pending || !enabled}
                onClick={onClearAvatar}
                type="button"
              >
                <X className="h-2.5 w-2.5" aria-hidden="true" />
              </button>
            ) : null}
            <input
              accept="image/*"
              className="hidden"
              onChange={onAvatarSelected}
              ref={fileInputRef}
              type="file"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="bb-mono-label">Photo</p>
            <p className="mt-1 text-[12.5px] leading-5 text-[#5F625E]">
              {enabled
                ? "Click to upload. Square works best."
                : "Sign in to upload a profile photo."}
            </p>
          </div>
        </div>

        {/* Name + Email side-by-side on wider screens. Email is read-only and
            visually demoted so it doesn't compete with the editable name. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="bb-mono-label">Display name</span>
            <input
              className="h-11 rounded-xl border border-[#D9DAD4] bg-white px-3.5 text-[14px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
              disabled={!enabled || pending}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="How clients should hear your name"
              type="text"
              value={fullName}
            />
          </label>
          <div className="grid gap-1.5">
            <span className="bb-mono-label">Email</span>
            <div className="flex min-h-11 items-center truncate rounded-xl border border-[#E7E7E2] bg-[#F6F6F3] px-3.5 text-[14px] text-[#5F625E]" title={email}>
              {email}
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-[12px] text-[#8E918B]">
            {enabled
              ? dirty
                ? "Unsaved changes"
                : "All changes saved"
              : "Sign in to edit your profile"}
          </p>
          <button
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
              dirty && enabled
                ? "bg-[#003C33] text-white hover:bg-[#0B4A3F]"
                : "bg-[#E7E7E2] text-[#8E918B]",
            )}
            disabled={!dirty || !enabled || pending}
            onClick={onSave}
            type="button"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            Save
          </button>
        </div>
      </div>
      <ToastViewport
        message={toast?.message ?? null}
        onDismiss={() => setToast(null)}
        tone={toast?.tone ?? "success"}
      />
    </>
  );
}
