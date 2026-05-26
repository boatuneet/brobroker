import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  KeyRound,
  LogOut,
  Mail,
} from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { AppShell } from "@/components/app-shell";
import { BrokerSegmentSelector } from "@/components/broker-segment-selector";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profile · BroBroker",
  description: "Manage your broker account and session.",
};

/* Account-detail timestamps benefit from year + time; the shared
   formatDate util only shows month/day for use in tables. */
function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ProfilePage() {
  const segment = await getActiveBrokerSegment();
  let user:
    | Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>>["data"]["user"]
    | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;
  }

  const userEmail = user?.email ?? "Account not connected";
  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";
  const memberSince = formatTimestamp(user?.created_at);
  const lastSignIn = formatTimestamp(user?.last_sign_in_at);
  const isConnected = Boolean(user);

  return (
    <AppShell active="Profile">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <PageHeader
          eyebrow="Account"
          title="Your profile"
          description="Manage your broker identity, market segment, and workspace session."
        />

        <Card className="mt-12">
          <CardHeader
            eyebrow="Broker segment"
            title="What do you sell?"
            description="Choose one operating mode. The portal filters listings, clients, tasks, reports, matching, and deal rooms around that segment."
          />
          <div className="px-6 py-5">
            <BrokerSegmentSelector currentSegment={segment} />
          </div>
        </Card>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:auto-rows-min">
          <Card className="overflow-hidden xl:col-start-1 xl:row-start-1">
            <div className="bg-[#003c33] px-6 py-7 text-white">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl font-medium text-[#003c33]">
                    {userInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="bb-mono-label !text-white/60">Broker account</p>
                    <h2 className="bb-display mt-2 truncate text-2xl font-medium text-white">
                      {userEmail}
                    </h2>
                  </div>
                </div>
                <Badge
                  className={
                    isConnected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className={`h-3 w-3 ${isConnected ? "text-emerald-500" : "text-amber-500"}`}
                  />
                  {isConnected ? "Signed in" : "Session unavailable"}
                </Badge>
              </div>
            </div>

            <dl className="grid gap-x-10 gap-y-5 px-6 py-6 sm:grid-cols-2">
              <DetailRow icon={Mail} label="Email" value={user?.email ?? "Not available"} />
              <DetailRow icon={KeyRound} label="User ID" mono value={user?.id ?? "—"} />
              <DetailRow icon={Calendar} label="Account created" value={memberSince} />
              <DetailRow icon={Clock} label="Last sign-in" value={lastSignIn} />
            </dl>
          </Card>

          <Card className="xl:col-start-2 xl:row-start-1">
            <CardHeader eyebrow="Session" title="Account actions" />
            <div className="grid gap-5 px-6 py-5">
              <div className="rounded-2xl bg-[#f7f7f9] p-4">
                <p className="text-[14px] font-medium text-[#17171c]">Need to switch brokers?</p>
                <p className="mt-2 text-[13px] leading-6 text-[#616161]">
                  Signing out clears this device&apos;s account session cookie. Nothing is sent or
                  deleted from your workspace.
                </p>
              </div>

              {isConnected ? (
                <form action={signOut}>
                  <button
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2a2a32]"
                    type="submit"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#17171c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2a2a32]"
                  href="/login"
                >
                  Sign in
                </Link>
              )}
            </div>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}

function DetailRow({
  icon: Icon,
  label,
  mono,
  value,
}: {
  icon: typeof Mail;
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#003c33]" />
        <dt className="bb-mono-label">{label}</dt>
      </div>
      <dd
        className={`mt-1.5 truncate text-[14px] text-[#17171c] ${mono ? "font-mono text-[13px]" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
