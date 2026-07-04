"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BuyerStage } from "@/lib/types";

/* Small persistence helper for the header stage selector. Kept tiny — mirrors
   how buyer intake calls `.from("buyers").upsert(...)`. Closure metadata rides
   inside `payload` because there are no dedicated columns for closedAt /
   closedReason / closedValueEur yet, and adding them requires a migration. */

export type UpdateBuyerStageResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateBuyerStage(
  buyerId: string,
  stage: BuyerStage,
  close?: { closedValueEur?: number; closedReason?: string },
): Promise<UpdateBuyerStageResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured — stage change is local only." };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, error: "Sign in required to save stage." };
  }

  // Read the current payload so we can merge closure metadata without
  // clobbering the rest of the intake payload (`fields`, `summary`, etc).
  const { data: existing, error: readError } = await supabase
    .from("buyers")
    .select("payload")
    .eq("id", buyerId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }

  const priorPayload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};

  const nextPayload =
    close || stage === "Closed Won" || stage === "Closed Lost"
      ? {
          ...priorPayload,
          closure: {
            ...(typeof priorPayload.closure === "object" && priorPayload.closure !== null
              ? (priorPayload.closure as Record<string, unknown>)
              : {}),
            stage,
            closedAt: new Date().toISOString(),
            ...(close?.closedValueEur !== undefined
              ? { closedValueEur: close.closedValueEur }
              : {}),
            ...(close?.closedReason !== undefined ? { closedReason: close.closedReason } : {}),
          },
        }
      : priorPayload;

  const { error } = await supabase
    .from("buyers")
    .update({ stage, payload: nextPayload })
    .eq("id", buyerId)
    .eq("owner_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
