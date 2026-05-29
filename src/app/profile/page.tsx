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
import { ProfileEditor } from "@/components/profile/profile-editor";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { fetchOwnProfile } from "@/lib/supabase/profiles";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Profile · BroBroker",
  description: "Manage your broker account and session.",
};

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
  let fullName: string | null = null;
  let avatarUrl: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    user = currentUser;

    if (user) {
      const profile = await fetchOwnProfile(supabase, user.id);
      fullName = profile?.full_name ?? null;
      avatarUrl = profile?.avatar_url ?? null;
    }
  }

  const userEmail = user?.email ?? "Account not connected";
  const memberSince = formatTimestamp(user?.created_at);
  const lastSignIn = formatTimestamp(user?.last_sign_in_at);
  const isConnected = Boolean(user);

  return (
    <AppShell active="Profile">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <PageHeader
          title="Your profile"
          description="Manage your broker identity, market segment, and workspace session."
        />

        {/* Two-column layout: identity editor on the left, account meta on the
            right. The grid collapses to a single column below xl so the editor
            owns full width on smaller screens. */}
        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-stretch">
          <Card className="!p-6">
            {/* Inline header keeps the eyebrow/title flush with the card's own
                padding — CardHeader would add its own px-6 py-5 on top. */}
            <div className="min-w-0">
              <p className="bb-mono-label">Identity</p>
              <h2 className="bb-display mt-1.5 text-lg font-medium text-[#171719]">
                How you appear
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#5F625E]">
                Your name and photo show up in conversations, drafts, and shared deal rooms.
              </p>
            </div>
            <div className="mt-5">
              <ProfileEditor
                email={userEmail}
                initialAvatarUrl={avatarUrl}
                initialFullName={fullName}
                userId={user?.id ?? null}
              />
            </div>
          </Card>

          {/* Flex column with mt-auto on the sign-out button so the card
              stretches to match the taller Identity card on its left. */}
          <Card className="flex !flex-col !p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="bb-mono-label">Session</p>
                <h2 className="bb-display mt-1.5 text-lg font-medium text-[#171719]">
                  Account
                </h2>
              </div>
              <Badge
                className={
                  isConnected
                    ? "border-[#E1F1EA] bg-[#E1F1EA] text-[#0F8F62]"
                    : "border-[#F0DDD0] bg-[#F0DDD0] text-[#A86642]"
                }
              >
                <CheckCircle2
                  aria-hidden="true"
                  className={`h-3 w-3 ${
                    isConnected ? "text-[#0F8F62]" : "text-[#A86642]"
                  }`}
                />
                {isConnected ? "Signed in" : "Disconnected"}
              </Badge>
            </div>

            <dl className="mt-5 grid gap-5 border-t border-[#E7E7E2] pt-5">
              <DetailRow icon={Mail} label="Email" value={user?.email ?? "Not available"} />
              <DetailRow icon={KeyRound} label="User ID" mono value={user?.id ?? "—"} />
              <DetailRow icon={Calendar} label="Created" value={memberSince} />
              <DetailRow icon={Clock} label="Last sign-in" value={lastSignIn} />
            </dl>

            {isConnected ? (
              <form action={signOut} className="mt-auto pt-5">
                <button
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-[#D9DAD4] bg-white px-5 text-[13px] font-semibold text-[#171719] transition-colors hover:bg-[#F1F2EE]"
                  type="submit"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-[#003C33] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0B4A3F]"
                href="/login"
              >
                Sign in
              </Link>
            )}
          </Card>
        </div>

        {/* Segment selector — full-width band so the three workspace cards
            have room to breathe. */}
        <Card className="mt-5">
          <CardHeader
            eyebrow="Workspace"
            title="What do you sell?"
            description="Choose one operating mode. The portal filters listings, clients, tasks, reports, matching, and deal rooms around that segment."
          />
          <div className="px-6 py-5">
            <BrokerSegmentSelector currentSegment={segment} />
          </div>
        </Card>
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
    /* Horizontal row: icon + label hug the left; value occupies the rest and
       truncates. Label uses whitespace-nowrap so "Last sign-in" never wraps. */
    <div className="flex items-center gap-3 text-[13px]">
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <Icon aria-hidden="true" className="h-3.5 w-3.5 text-[#003C33]" />
        <dt className="bb-mono-label">{label}</dt>
      </div>
      <dd
        className={`min-w-0 flex-1 truncate text-right text-[#171719] ${mono ? "font-mono text-[12px]" : "text-[13px]"}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
