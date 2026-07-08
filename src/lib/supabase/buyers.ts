import { cache } from "react";
import { type BrokerSegment } from "@/lib/broker-segments";
import {
  getStoredBuyerSegment,
  mapStoredBuyerToProfile,
  type StoredBuyerRow,
} from "@/lib/stored-buyers";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

export const getStoredBuyersForSegment = cache(async (segment?: BrokerSegment) => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Could not read Supabase buyers", error.message);
    return [];
  }

  const rows = (data ?? []) as StoredBuyerRow[];
  const filteredRows = segment
    ? rows.filter((row) => getStoredBuyerSegment(row) === segment)
    : rows;

  return filteredRows.map(mapStoredBuyerToProfile);
});

export const getStoredBuyerById = cache(async (id: string) => {
  const user = await getCurrentUser();
  if (!user) return undefined;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Could not read Supabase buyer", error.message);
    return undefined;
  }

  return data ? mapStoredBuyerToProfile(data as StoredBuyerRow) : undefined;
});

/* The buyer's saved Trust-tab verification status (payload.verification.status).
   Parsed inline — no import of the browser-client module, no error swallowing —
   so the header badge / Qualify step reliably reflect the broker's decision.
   One indexed lookup. */
export const getStoredBuyerVerificationStatus = cache(
  async (id: string): Promise<"Verified" | "Needs Review" | "High Risk" | undefined> => {
    const user = await getCurrentUser();
    if (!user) return undefined;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("buyers")
      .select("payload")
      .eq("owner_user_id", user.id)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return undefined;
    const payload = (data as { payload: unknown }).payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
    const verification = (payload as Record<string, unknown>).verification;
    if (!verification || typeof verification !== "object") return undefined;
    const status = (verification as Record<string, unknown>).status;
    return status === "Verified" || status === "Needs Review" || status === "High Risk"
      ? status
      : undefined;
  },
);

