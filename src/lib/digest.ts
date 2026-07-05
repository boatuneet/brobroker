import "server-only";
import { createClient } from "@supabase/supabase-js";

/* Morning digest for a single broker. Runs under the service role so the cron
   handler can iterate every broker without a session, and so we can join
   deal_room_questions across all rooms the broker owns without hitting RLS
   quirks. Every helper here reads by owner_user_id, so it's still scoped.

   ponytail: two separate queries for rooms→questions (no server-side join)
   because supabase-js `select("*, rel(...)")` gets fussy with service role
   RLS bypass — cheaper to just inline the two calls than fight the SDK. */

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function createDigestServiceClient() {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return null;
  if (SUPABASE_URL.includes("YOUR-PROJECT-REF")) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type BrokerDigest = {
  overdue: number;
  dueToday: number;
  openQuestions: number;
  goingCold: { name: string }[];
  hasAnything: boolean;
};

const EMPTY: BrokerDigest = {
  overdue: 0,
  dueToday: 0,
  openQuestions: 0,
  goingCold: [],
  hasAnything: false,
};

const COLD_THRESHOLD_DAYS = 14;
const CLOSED_STAGES = new Set(["Closed Won", "Closed Lost"]);

export async function buildBrokerDigest(userId: string): Promise<BrokerDigest> {
  const supabase = createDigestServiceClient();
  if (!supabase) return EMPTY;

  const todayIso = new Date().toISOString().slice(0, 10);

  // Tasks — one pull, count in memory. Broker task volumes are tiny.
  const { data: taskRows } = await supabase
    .from("broker_tasks")
    .select("due_at, status")
    .eq("owner_user_id", userId)
    .neq("status", "Done")
    .limit(500);

  let overdue = 0;
  let dueToday = 0;
  for (const row of taskRows ?? []) {
    const due = typeof row.due_at === "string" ? row.due_at.slice(0, 10) : "";
    if (!due) continue;
    if (due < todayIso) overdue++;
    else if (due === todayIso) dueToday++;
  }

  // Open buyer questions across the broker's rooms.
  const { data: roomRows } = await supabase
    .from("deal_rooms")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(500);
  const roomIds = (roomRows ?? []).map((r) => r.id as string);

  let openQuestions = 0;
  if (roomIds.length) {
    const { count } = await supabase
      .from("deal_room_questions")
      .select("id", { count: "exact", head: true })
      .in("room_id", roomIds)
      .eq("status", "open");
    openQuestions = count ?? 0;
  }

  // Going-cold buyers — last contact ≥14 days, not closed.
  const { data: buyerRows } = await supabase
    .from("buyers")
    .select("name, stage, preferences, created_at")
    .eq("owner_user_id", userId)
    .limit(500);

  const cutoff = Date.now() - COLD_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const goingCold: { name: string }[] = [];
  for (const row of buyerRows ?? []) {
    const stage = typeof row.stage === "string" ? row.stage : "";
    if (CLOSED_STAGES.has(stage)) continue;
    // preferences.lastContactedAt || created_at — same mapping as stored-buyers.
    const prefs =
      row.preferences && typeof row.preferences === "object" && !Array.isArray(row.preferences)
        ? (row.preferences as { lastContactedAt?: unknown })
        : {};
    const lastRaw =
      typeof prefs.lastContactedAt === "string" ? prefs.lastContactedAt : row.created_at;
    if (typeof lastRaw !== "string") continue;
    const lastMs = Date.parse(lastRaw);
    if (Number.isNaN(lastMs)) continue;
    if (lastMs < cutoff) {
      const name = typeof row.name === "string" && row.name.trim() ? row.name : "Unnamed buyer";
      goingCold.push({ name });
    }
  }

  const hasAnything =
    overdue > 0 || dueToday > 0 || openQuestions > 0 || goingCold.length > 0;

  return { overdue, dueToday, openQuestions, goingCold, hasAnything };
}
