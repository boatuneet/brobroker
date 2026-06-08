"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { deleteListing } from "@/lib/supabase/delete-listing";
import { Button } from "./ui";

/* Square icon-only delete control for the listing hero, with a confirmation
   dialog because deletion is permanent. */
export function ListingDeleteButton({
  listingId,
  listingName,
}: {
  listingId: string;
  listingName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy]);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteListing(listingId);
    if (!result.ok) {
      setError(result.error ?? "Could not delete this listing.");
      setBusy(false);
      return;
    }
    router.push("/listings");
    router.refresh();
  }

  return (
    <>
      <button
        aria-label="Delete listing"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#D9DAD4] bg-white text-[#5F625E] transition-colors hover:border-[#b30000] hover:text-[#b30000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b30000]"
        onClick={() => setOpen(true)}
        title="Delete listing"
        type="button"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>

      {open ? (
        <div
          aria-labelledby="delete-listing-title"
          aria-modal="true"
          className="bb-overlay-enter fixed inset-0 z-[80] flex items-center justify-center bg-[#171719]/30 p-5 backdrop-blur-sm"
          onClick={() => {
            if (!busy) setOpen(false);
          }}
          role="dialog"
        >
          <div
            className="bb-dialog-enter w-full max-w-md rounded-[16px] border border-[#E7E7E7] bg-white p-7 shadow-[0_24px_64px_rgba(23,25,28,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#F0DDD0] text-[#b30000]">
              <TriangleAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 id="delete-listing-title" className="bb-display mt-5 text-xl font-medium text-[#171719]">
              Delete this listing?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#5F625E]">
              <span className="font-medium text-[#171719]">{listingName}</span> and its imported photos
              will be permanently removed from your workspace. This can’t be undone.
            </p>
            {error ? (
              <p className="mt-3 rounded-[10px] bg-[#F0DDD0] px-3 py-2.5 text-[13px] leading-6 text-[#A86642]">
                {error}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
              <Button
                className="sm:flex-1"
                disabled={busy}
                onClick={() => void confirmDelete()}
                type="button"
                variant="danger"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {busy ? "Deleting…" : "Delete listing"}
              </Button>
              <Button
                className="sm:flex-1"
                disabled={busy}
                onClick={() => setOpen(false)}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
