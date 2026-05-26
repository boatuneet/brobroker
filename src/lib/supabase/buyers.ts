import { cache } from "react";
import { type BrokerSegment } from "@/lib/broker-segments";
import {
  getStoredBuyerSegment,
  mapStoredBuyerToProfile,
  type StoredBuyerRow,
} from "@/lib/stored-buyers";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";

export const getStoredBuyersForSegment = cache(async (segment?: BrokerSegment) => {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

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
  if (!isSupabaseConfigured()) return undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return undefined;

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

