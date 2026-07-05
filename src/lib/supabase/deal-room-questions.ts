import { cache } from "react";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";

/* Reads for deal_room_questions (authed broker only). RLS scopes rows to
   rooms the broker owns; we also filter by room_id for cache hits. */

export type RoomQuestion = {
  id: string;
  roomId: string;
  question: string;
  autoAnswer: string | null;
  status: "open" | "answered";
  brokerAnswer: string | null;
  askedAt: string;
  answeredAt: string | null;
};

type Row = {
  id: string;
  room_id: string;
  question: string;
  auto_answer: string | null;
  status: string;
  broker_answer: string | null;
  asked_at: string;
  answered_at: string | null;
};

function mapRow(row: Row): RoomQuestion {
  return {
    id: row.id,
    roomId: row.room_id,
    question: row.question,
    autoAnswer: row.auto_answer,
    status: row.status === "answered" ? "answered" : "open",
    brokerAnswer: row.broker_answer,
    askedAt: row.asked_at,
    answeredAt: row.answered_at,
  };
}

export const getRoomQuestions = cache(
  async (roomId: string): Promise<RoomQuestion[]> => {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("deal_room_questions")
      .select("*")
      .eq("room_id", roomId)
      .order("asked_at", { ascending: false });

    if (error) {
      console.warn("Could not read deal room questions", error.message);
      return [];
    }
    return ((data ?? []) as Row[]).map(mapRow);
  },
);

/* Open-question summary across ALL of the broker's rooms — powers Today's
   risk queue row. Returns the count plus the room with the newest open
   question so the row can deep-link straight to the right room panel. */
export const getOpenRoomQuestionSummary = cache(
  async (): Promise<{ count: number; roomId?: string }> => {
    const user = await getCurrentUser();
    if (!user) return { count: 0 };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("deal_room_questions")
      .select("room_id, asked_at")
      .eq("status", "open")
      .order("asked_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("Could not summarize open room questions", error.message);
      return { count: 0 };
    }
    const rows = (data ?? []) as Array<{ room_id: string }>;
    return { count: rows.length, roomId: rows[0]?.room_id };
  },
);
