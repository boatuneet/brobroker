import { cache } from "react";
import type { BrokerTask } from "@/lib/types";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

/* Fetch the broker's OPEN task rows, mapped to the app's BrokerTask shape.
   This is what lets Today's "Needs me now" hero + queue run on the broker's
   real tasks instead of only the demo pool (counts alone caused the hero to
   say "nothing urgent" while the KPI counted 22 open tasks). Returns [] on
   any failure — graceful degrade, never throws. */
export const getStoredTasks = cache(async (): Promise<BrokerTask[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broker_tasks")
    .select("id, title, kind, priority, status, due_at, reason, action_label, buyer_id, seller_id, asset_id")
    .eq("owner_user_id", user.id)
    .neq("status", "Done")
    .order("due_at", { ascending: true })
    .limit(200);

  if (error) {
    console.warn("Could not load stored tasks", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: row.title ?? "Untitled task",
    kind: normalizeKind(row.kind),
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row.status),
    // due_at is a date column; missing dates fall back to today so the task
    // surfaces rather than silently sorting to the end of time.
    dueAt: row.due_at ?? new Date().toISOString().slice(0, 10),
    reason: row.reason ?? "",
    actionLabel: row.action_label ?? "Open",
    buyerId: row.buyer_id ?? undefined,
    sellerId: row.seller_id ?? undefined,
    listingId: row.asset_id ?? undefined,
  }));
});

function normalizeKind(value: unknown): BrokerTask["kind"] {
  const kinds: BrokerTask["kind"][] = [
    "Follow-Up",
    "Owner Update",
    "Verification",
    "Document",
    "Matching",
    "Viewing",
    "CRM",
  ];
  return kinds.includes(value as BrokerTask["kind"]) ? (value as BrokerTask["kind"]) : "Follow-Up";
}

function normalizePriority(value: unknown): BrokerTask["priority"] {
  return value === "Critical" || value === "High" || value === "Medium" || value === "Low"
    ? value
    : "Medium";
}

function normalizeStatus(value: unknown): BrokerTask["status"] {
  return value === "Open" || value === "In Progress" || value === "Waiting" || value === "Done"
    ? value
    : "Open";
}

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
