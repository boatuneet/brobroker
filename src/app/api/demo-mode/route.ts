import { NextResponse } from "next/server";
import { DEMO_MODE_COOKIE, serializeDemoModeFlag } from "@/lib/demo-mode";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = body.enabled !== false; // anything not strictly false → on
  const response = NextResponse.json({ enabled });

  response.cookies.set(DEMO_MODE_COOKIE, serializeDemoModeFlag(enabled), {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
