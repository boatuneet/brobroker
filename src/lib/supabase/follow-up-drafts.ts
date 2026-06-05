import { cache } from "react";
import type { DraftStatus, FollowUpDraft, FollowUpDraftKind } from "@/lib/types";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

type StoredFollowUpDraftRow = {
  id: string;
  buyer_id: string | null;
  seller_id: string | null;
  asset_id: string | null;
  kind: string | null;
  channel: string | null;
  status: string | null;
  subject: string | null;
  body: string | null;
  created_at: string | null;
};

export const getStoredFollowUpDraftsForBuyer = cache(
  async (buyerId: string): Promise<FollowUpDraft[]> => {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("follow_up_drafts")
      .select("*")
      .eq("owner_user_id", user.id)
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not read Supabase follow_up_drafts", error.message);
      return [];
    }

    const rows = (data ?? []) as StoredFollowUpDraftRow[];
    return rows.map(mapStoredFollowUpDraft);
  },
);

function mapStoredFollowUpDraft(row: StoredFollowUpDraftRow): FollowUpDraft {
  return {
    id: row.id,
    buyerId: row.buyer_id ?? undefined,
    sellerId: row.seller_id ?? undefined,
    listingId: row.asset_id ?? undefined,
    kind: normalizeKind(row.kind),
    channel: normalizeChannel(row.channel),
    status: normalizeStatus(row.status),
    subject: row.subject ?? "",
    body: row.body ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function normalizeKind(value: unknown): FollowUpDraftKind | undefined {
  if (
    value === "Inquiry Reply" ||
    value === "Post-Call Follow-Up" ||
    value === "Viewing Recap" ||
    value === "Negotiation Update"
  ) {
    return value;
  }
  return undefined;
}

function normalizeChannel(value: unknown): FollowUpDraft["channel"] {
  if (value === "Email" || value === "WhatsApp" || value === "SMS" || value === "Call Summary") {
    return value;
  }
  return "Email";
}

function normalizeStatus(value: unknown): DraftStatus {
  if (value === "Draft" || value === "Edited" || value === "Approved") {
    return value;
  }
  return "Draft";
}
