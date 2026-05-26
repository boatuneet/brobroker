"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ListingCoordinates, ListingPhoto } from "@/lib/types";

export type SessionBuyer = {
  id: string;
  name: string;
  source: "Voice CRM" | "Matching" | "Manual";
  summary: string;
  budgetLabel?: string;
  urgency?: string;
  createdAt: string;
};

export type SessionAsset = {
  id: string;
  assetType: "Yacht" | "Car" | "Real Estate";
  name: string;
  builder: string;
  model: string;
  location: string;
  address?: string;
  locationLabel?: string;
  locationPrecision?: "Exact" | "Area" | "Private";
  coordinates?: ListingCoordinates;
  priceEur: number;
  status: string;
  summary: string;
  specSummary?: string;
  photos?: ListingPhoto[];
  segmentPayload?: Record<string, unknown>;
  createdAt: string;
};

export function readPersisted<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePersisted<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function mergeById<T extends { id: string }>(base: T[], extra: T[]) {
  const seen = new Set<string>();

  return [...extra, ...base].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function mirrorWorkflowEvent(kind: string, recordId: string | undefined, payload: unknown) {
  if (!isSupabaseConfigured()) return;

  const supabase = createClient();
  void supabase
    .from("workflow_events")
    .insert({
      kind,
      record_id: recordId,
      payload,
    })
    .then(({ error }) => {
      if (error) {
        console.warn("Could not mirror BroBroker workflow event to Supabase", error.message);
      }
    });
}

export function saveSessionBuyer(buyer: SessionBuyer) {
  const current = readPersisted<SessionBuyer[]>("brobroker:buyers:session", []);
  const next = [buyer, ...current.filter((item) => item.id !== buyer.id)].slice(0, 20);
  writePersisted("brobroker:buyers:session", next);
  mirrorWorkflowEvent("session_buyer_saved", buyer.id, buyer);
  return next;
}

export function deleteSessionBuyer(id: string) {
  const current = readPersisted<SessionBuyer[]>("brobroker:buyers:session", []);
  const next = current.filter((item) => item.id !== id);
  writePersisted("brobroker:buyers:session", next);
  mirrorWorkflowEvent("session_buyer_deleted", id, { id });
  return next;
}

export function saveSessionAsset(asset: SessionAsset) {
  const current = readPersisted<SessionAsset[]>("brobroker:assets:session", []);
  const next = [asset, ...current.filter((item) => item.id !== asset.id)].slice(0, 20);
  writePersisted("brobroker:assets:session", next);
  mirrorWorkflowEvent("session_asset_saved", asset.id, asset);
  return next;
}
