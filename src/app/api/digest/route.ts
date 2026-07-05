import { NextResponse } from "next/server";
import { buildBrokerDigest, createDigestServiceClient } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/email";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";

/* GET is the cron entry. Vercel Cron sends `authorization: Bearer <CRON_SECRET>`
   automatically when CRON_SECRET is set as a project env var — we require it.
   POST is the authed "test digest" button from Settings.

   Middleware bypass: /api/digest is in proxy.ts PUBLIC_ROUTES because the cron
   request has no Supabase session cookie and would otherwise redirect to
   /login. POST re-verifies the user itself via getCurrentUser(), so bypassing
   the middleware does not weaken it.

   ponytail: 100-user cap on the cron. Resend free tier is 100 emails/day,
   3 req/sec — sequential loop stays well under that. Bump to paginated
   listUsers + Promise.all batches when broker count crosses 100. */

export const dynamic = "force-dynamic";

const MAX_USERS_PER_RUN = 100;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createDigestServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service client not configured" }, { status: 500 });
  }

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: MAX_USERS_PER_RUN,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of data.users ?? []) {
    if (!user.email) {
      skipped++;
      continue;
    }
    const digest = await buildBrokerDigest(user.id);
    if (!digest.hasAnything) {
      skipped++;
      continue;
    }
    const result = await sendDigestEmail(user.email, digest);
    if (result.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ sent, skipped, failed });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  // Need the email — getCurrentUser only returns { id }. Read from getUser().
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "No email on your account" }, { status: 400 });
  }

  const digest = await buildBrokerDigest(user.id);
  const result = await sendDigestEmail(email, digest);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, sentTo: email });
}
