import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/env";
import type { BuyerProfile } from "./types";

/* A "requirement set" is one buyer ask the matcher can run against. A buyer's
   on-record ask is the implicit "Primary" set; brokers can add more so matching
   isn't locked to one brief.

   Persisted in Supabase (table: requirement_sets) when configured + signed in,
   otherwise on the device (localStorage). buyer_id is a plain string so both
   demo and stored buyers can carry sets. */
export interface RequirementSet {
  id: string;
  label: string;
  budgetMinEur: number;
  budgetMaxEur: number;
  sizeRangeFt: [number, number];
  preferredBrands: string[];
  preferredLocations: string[];
  mustHaves: string[];
  dealBreakers: string[];
  urgency?: BuyerProfile["urgency"];
  active?: boolean;
  createdAt: string;
}

/* Returns a buyer with its ask fields overridden by the set — person-level
   memory (taste, relationship notes, communication) is preserved so it still
   feeds the ranking. */
export function mergeRequirementSet(buyer: BuyerProfile, set: RequirementSet): BuyerProfile {
  return {
    ...buyer,
    budgetMinEur: set.budgetMinEur,
    budgetMaxEur: set.budgetMaxEur,
    sizeRangeFt: set.sizeRangeFt,
    preferredBrands: set.preferredBrands,
    preferredLocations: set.preferredLocations,
    mustHaves: set.mustHaves,
    dealBreakers: set.dealBreakers,
    urgency: set.urgency ?? buyer.urgency,
  };
}

/* ------------------------------------------------------------------ *
 * Local (device) fallback
 * ------------------------------------------------------------------ */
const SETS_KEY = "brobroker:requirement-sets";
const ACTIVE_KEY = "brobroker:requirement-active";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return (JSON.parse(window.localStorage.getItem(key) || "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function localAll(): Record<string, RequirementSet[]> {
  const store = readJson<Record<string, RequirementSet[]>>(SETS_KEY, {});
  const active = readJson<Record<string, string>>(ACTIVE_KEY, {});
  const out: Record<string, RequirementSet[]> = {};
  for (const [buyerId, sets] of Object.entries(store)) {
    out[buyerId] = sets.map((set) => ({ ...set, active: active[buyerId] === set.id }));
  }
  return out;
}

function writeLocalSets(buyerId: string, sets: RequirementSet[]) {
  if (typeof window === "undefined") return;
  const store = readJson<Record<string, RequirementSet[]>>(SETS_KEY, {});
  store[buyerId] = sets.map((set) => {
    const copy = { ...set };
    delete copy.active;
    return copy;
  });
  window.localStorage.setItem(SETS_KEY, JSON.stringify(store));
}

function writeLocalActive(buyerId: string, setId: string) {
  if (typeof window === "undefined") return;
  const active = readJson<Record<string, string>>(ACTIVE_KEY, {});
  if (setId === "primary") delete active[buyerId];
  else active[buyerId] = setId;
  window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
}

/* ------------------------------------------------------------------ *
 * Supabase
 * ------------------------------------------------------------------ */
type RequirementSetRow = {
  id: string;
  buyer_id: string;
  label: string;
  budget_min_eur: number | null;
  budget_max_eur: number | null;
  size_min_ft: number | null;
  size_max_ft: number | null;
  preferred_brands: unknown;
  preferred_locations: unknown;
  must_haves: unknown;
  deal_breakers: unknown;
  urgency: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapRow(row: RequirementSetRow): RequirementSet {
  return {
    id: row.id,
    label: row.label,
    budgetMinEur: Number(row.budget_min_eur) || 0,
    budgetMaxEur: Number(row.budget_max_eur) || 0,
    sizeRangeFt: [Number(row.size_min_ft) || 0, Number(row.size_max_ft) || 0],
    preferredBrands: asStringList(row.preferred_brands),
    preferredLocations: asStringList(row.preferred_locations),
    mustHaves: asStringList(row.must_haves),
    dealBreakers: asStringList(row.deal_breakers),
    urgency: (row.urgency as BuyerProfile["urgency"]) ?? undefined,
    active: Boolean(row.is_active),
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

function toRow(buyerId: string, set: RequirementSet) {
  return {
    id: set.id,
    buyer_id: buyerId,
    label: set.label,
    budget_min_eur: set.budgetMinEur,
    budget_max_eur: set.budgetMaxEur,
    size_min_ft: set.sizeRangeFt[0],
    size_max_ft: set.sizeRangeFt[1],
    preferred_brands: set.preferredBrands,
    preferred_locations: set.preferredLocations,
    must_haves: set.mustHaves,
    deal_breakers: set.dealBreakers,
    urgency: set.urgency ?? null,
    is_active: set.active ?? false,
  };
}

async function authedClient() {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? supabase : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Public API (Supabase-first, local fallback)
 * ------------------------------------------------------------------ */
export async function loadRequirementSets(buyerId: string): Promise<RequirementSet[]> {
  const supabase = await authedClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("requirement_sets")
      .select("*")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: true });
    if (!error) {
      const rows = ((data as RequirementSetRow[] | null) ?? []).map(mapRow);
      // Fall back to the local cache when Supabase has nothing yet (e.g. sets
      // created before the migration, or table not created) so they don't vanish.
      if (rows.length) return rows;
    } else {
      console.warn("Could not read requirement sets", error.message);
    }
  }
  return localAll()[buyerId] ?? [];
}

export async function loadAllRequirementSets(): Promise<Record<string, RequirementSet[]>> {
  const supabase = await authedClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("requirement_sets")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error) {
      const map: Record<string, RequirementSet[]> = {};
      for (const row of (data as RequirementSetRow[] | null) ?? []) {
        (map[row.buyer_id] ??= []).push(mapRow(row));
      }
      if (Object.keys(map).length) return map;
    } else {
      console.warn("Could not read requirement sets", error.message);
    }
  }
  return localAll();
}

async function upsertRequirementSet(buyerId: string, set: RequirementSet) {
  // Always write to device storage first — a durable cache so a refresh never
  // loses the set even if Supabase isn't reachable / the table isn't created.
  const sets = localAll()[buyerId] ?? [];
  const next = sets.some((entry) => entry.id === set.id)
    ? sets.map((entry) => (entry.id === set.id ? set : entry))
    : [...sets, set];
  writeLocalSets(buyerId, next);
  // Best-effort sync to Supabase when signed in.
  const supabase = await authedClient();
  if (supabase) {
    const { error } = await supabase.from("requirement_sets").upsert(toRow(buyerId, set));
    if (error) console.warn("Could not sync requirement set to Supabase", error.message);
  }
}

async function deleteRequirementSet(buyerId: string, setId: string) {
  writeLocalSets(buyerId, (localAll()[buyerId] ?? []).filter((entry) => entry.id !== setId));
  const supabase = await authedClient();
  if (supabase) {
    const { error } = await supabase.from("requirement_sets").delete().eq("id", setId);
    if (error) console.warn("Could not delete requirement set in Supabase", error.message);
  }
}

async function persistActiveSet(buyerId: string, setId: string) {
  writeLocalActive(buyerId, setId);
  const supabase = await authedClient();
  if (supabase) {
    await supabase.from("requirement_sets").update({ is_active: false }).eq("buyer_id", buyerId);
    if (setId !== "primary") {
      await supabase.from("requirement_sets").update({ is_active: true }).eq("id", setId);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Hook used by the Matches tab
 * ------------------------------------------------------------------ */
export function useRequirementSets(buyerId: string) {
  const [sets, setSets] = useState<RequirementSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string>("primary");

  useEffect(() => {
    let cancelled = false;
    void loadRequirementSets(buyerId).then((loaded) => {
      if (cancelled) return;
      setSets(loaded);
      setActiveSetId(loaded.find((set) => set.active)?.id ?? "primary");
    });
    return () => {
      cancelled = true;
    };
  }, [buyerId]);

  const selectActive = useCallback(
    (id: string) => {
      setActiveSetId(id);
      setSets((current) => current.map((set) => ({ ...set, active: set.id === id })));
      void persistActiveSet(buyerId, id);
    },
    [buyerId],
  );

  const saveSet = useCallback(
    (set: RequirementSet) => {
      setSets((current) => {
        const exists = current.some((entry) => entry.id === set.id);
        return exists
          ? current.map((entry) => (entry.id === set.id ? { ...set, active: entry.active } : entry))
          : [...current, { ...set, active: false }];
      });
      void upsertRequirementSet(buyerId, set);
    },
    [buyerId],
  );

  const removeSet = useCallback(
    (id: string) => {
      setSets((current) => current.filter((entry) => entry.id !== id));
      setActiveSetId((current) => (current === id ? "primary" : current));
      void deleteRequirementSet(buyerId, id);
    },
    [buyerId],
  );

  return { sets, activeSetId, selectActive, saveSet, removeSet };
}
