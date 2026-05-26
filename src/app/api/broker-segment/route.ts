import { NextResponse } from "next/server";
import { BROKER_SEGMENT_COOKIE, normalizeBrokerSegment } from "@/lib/broker-segments";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { segment?: string };
  const segment = normalizeBrokerSegment(body.segment);
  const response = NextResponse.json({ segment });

  response.cookies.set(BROKER_SEGMENT_COOKIE, segment, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
