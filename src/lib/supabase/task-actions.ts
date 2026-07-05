"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./env";

/* Quick task mutations for Today's hero + queue rows. Owner-scoped updates
   on broker_tasks. Demo tasks (ids not in the table) match 0 rows — treated
   as ok so the optimistic UI stands for the session (demo data resets on
   reload anyway). */

export type TaskActionResult = { ok: boolean; error?: string };

export async function completeTask(taskId: string): Promise<TaskActionResult> {
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to update tasks." };

  const { error } = await supabase
    .from("broker_tasks")
    .update({
      status: "Done",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", user.id)
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function snoozeTask(taskId: string, days = 3): Promise<TaskActionResult> {
  if (!isSupabaseConfigured()) return { ok: true };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to update tasks." };

  const next = new Date();
  next.setDate(next.getDate() + days);
  const { error } = await supabase
    .from("broker_tasks")
    .update({
      due_at: next.toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", user.id)
    .eq("id", taskId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
