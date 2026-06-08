import { cache } from "react";
import type { DealRoom, DealRoomStatus, VerificationStatus } from "@/lib/types";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

/* Reads for the deal_rooms table (already provisioned in
   brobroker-manual-setup.sql). Writes happen client-side in the New room
   flow with the browser client, mirroring how buyer intake persists buyers. */

export type StoredDealRoomRow = {
  id: string;
  owner_user_id: string | null;
  buyer_id: string | null;
  title: string;
  status: string;
  verification_status: string;
  broker_approval_status: string;
  asset_ids: string[] | null;
  itinerary: string[] | null;
  approved_document_ids: string[] | null;
  share_token: string | null;
  payload: unknown;
  created_at: string | null;
  updated_at: string | null;
};

const VALID_STATUSES: ReadonlyArray<DealRoomStatus> = ["Draft", "Active", "Paused"];
const VALID_VERIFICATIONS: ReadonlyArray<VerificationStatus> = [
  "Verified",
  "Needs Review",
  "High Risk",
];
const VALID_APPROVALS: ReadonlyArray<DealRoom["brokerApprovalStatus"]> = [
  "Not Requested",
  "Pending",
  "Approved",
];

export function mapStoredDealRoomToDealRoom(row: StoredDealRoomRow): DealRoom {
  const payload = asRecord(row.payload);

  return {
    id: row.id,
    /* buyer_id is a nullable FK to public.buyers — rooms curated for demo
       buyers store the buyer reference in payload instead. */
    buyerId: row.buyer_id ?? readString(payload.buyerId) ?? "",
    title: row.title,
    status: normalize(row.status, VALID_STATUSES, "Draft"),
    verificationStatus: normalize(row.verification_status, VALID_VERIFICATIONS, "Needs Review"),
    brokerApprovalStatus: normalize(row.broker_approval_status, VALID_APPROVALS, "Pending"),
    listingIds: row.asset_ids ?? [],
    itinerary: row.itinerary ?? [],
    approvedDocumentIds: row.approved_document_ids ?? [],
    lastUpdatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

export const getStoredDealRooms = cache(async (): Promise<DealRoom[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_rooms")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("Could not read Supabase deal rooms", error.message);
    return [];
  }

  return ((data ?? []) as StoredDealRoomRow[]).map(mapStoredDealRoomToDealRoom);
});

export const getStoredDealRoomById = cache(async (id: string): Promise<DealRoom | undefined> => {
  const user = await getCurrentUser();
  if (!user) return undefined;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_rooms")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Could not read Supabase deal room", error.message);
    return undefined;
  }

  return data ? mapStoredDealRoomToDealRoom(data as StoredDealRoomRow) : undefined;
});

function normalize<T extends string>(value: string, valid: ReadonlyArray<T>, fallback: T): T {
  return (valid as ReadonlyArray<string>).includes(value) ? (value as T) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
