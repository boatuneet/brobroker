import { NextResponse } from "next/server";
import { insertRoomQuestion } from "@/lib/supabase/service";

/* Public buyer-question submission from the shared /room/[id] page.
   Anonymous — no auth required. Server-only because it uses the service
   role client. See supabase/brobroker-deal-room-questions.sql for the
   security model (no anon RLS insert; API is the only writer).
   ponytail: rate limiting is a future hardening step. */

export const dynamic = "force-dynamic";

const MAX_QUESTION_LEN = 1000;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const rawQuestion = typeof body.question === "string" ? body.question.trim() : "";
  const autoAnswer =
    typeof body.autoAnswer === "string" && body.autoAnswer.trim()
      ? body.autoAnswer.trim().slice(0, 4000)
      : undefined;

  if (!roomId) {
    return NextResponse.json({ error: "roomId is required." }, { status: 400 });
  }
  if (!rawQuestion) {
    return NextResponse.json({ error: "Question is empty." }, { status: 400 });
  }

  const question = rawQuestion.slice(0, MAX_QUESTION_LEN);
  const result = await insertRoomQuestion(roomId, question, autoAnswer);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
