"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Broker replies to a buyer question. RLS restricts to rooms the broker
   owns, so the plain client update is safe. */
export async function answerRoomQuestion(
  id: string,
  brokerAnswer: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = createClient();
  const { error } = await supabase
    .from("deal_room_questions")
    .update({
      broker_answer: brokerAnswer,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* Mark answered without a written reply (e.g. followed up out-of-band). */
export async function markRoomQuestionAnswered(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = createClient();
  const { error } = await supabase
    .from("deal_room_questions")
    .update({
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
