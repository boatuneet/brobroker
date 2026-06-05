import { cache } from "react";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

/* Count how many tasks the signed-in broker has marked as completed since
   the first of the current calendar month. Powers the "Completed this
   month" tile on the dashboard.

   Requires the broker_tasks.completed_at column added in the analytics
   migration (supabase/brobroker-analytics-2026-06.sql). Returns 0 if
   Supabase isn't configured or the broker is signed out — graceful
   degrade, never throws. */
export const getStoredCompletedTasksThisMonth = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const startOfMonth = startOfCurrentMonthIso();

  const { count, error } = await supabase
    .from("broker_tasks")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id)
    .gte("completed_at", startOfMonth);

  if (error) {
    console.warn("Could not count completed tasks this month", error.message);
    return 0;
  }

  return count ?? 0;
});

/* Open broker tasks count — anything not in the "Done" status. Lets the
   dashboard show "tasks to do" without pulling the full task payload. */
export const getStoredOpenTasksCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("broker_tasks")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id)
    .neq("status", "Done");

  if (error) {
    console.warn("Could not count open tasks", error.message);
    return 0;
  }

  return count ?? 0;
});

function startOfCurrentMonthIso(): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return start.toISOString();
}
