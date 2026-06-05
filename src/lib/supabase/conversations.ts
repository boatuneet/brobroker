import { cache } from "react";
import type { Conversation } from "@/lib/types";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

type StoredConversationRow = {
  id: string;
  buyer_id: string | null;
  seller_id: string | null;
  asset_id: string | null;
  channel: string | null;
  summary: string | null;
  sentiment: string | null;
  occurred_at: string | null;
  needs_summary: boolean | null;
  created_at: string | null;
};

export const getStoredConversationsForBuyer = cache(
  async (buyerId: string): Promise<Conversation[]> => {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("owner_user_id", user.id)
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Could not read Supabase conversations", error.message);
      return [];
    }

    const rows = (data ?? []) as StoredConversationRow[];
    return rows.map(mapStoredConversation);
  },
);

function mapStoredConversation(row: StoredConversationRow): Conversation {
  return {
    id: row.id,
    buyerId: row.buyer_id ?? undefined,
    sellerId: row.seller_id ?? undefined,
    listingId: row.asset_id ?? undefined,
    channel: normalizeChannel(row.channel),
    summary: row.summary ?? "",
    sentiment: normalizeSentiment(row.sentiment),
    occurredAt: row.occurred_at ?? row.created_at ?? new Date().toISOString(),
    needsSummary: row.needs_summary ?? false,
  };
}

function normalizeChannel(value: unknown): Conversation["channel"] {
  if (
    value === "Call" ||
    value === "Email" ||
    value === "WhatsApp" ||
    value === "SMS" ||
    value === "Viewing" ||
    value === "Sea Trial"
  ) {
    return value;
  }
  return "Call";
}

function normalizeSentiment(value: unknown): Conversation["sentiment"] {
  if (value === "Positive" || value === "Neutral" || value === "Concerned") {
    return value;
  }
  return "Neutral";
}
